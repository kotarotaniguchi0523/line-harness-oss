import { AssignTagSchema, FriendMetadataSchema, SendFriendMessageSchema, UuidSchema } from "@line-crm/contracts";
import { createFriendRepository, createScenarioRepository, DateTime } from "@line-crm/db";
import type { FriendId, LineAccountId, ScenarioId, TagId } from "@line-crm/domain";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";
import { fireEvent } from "../services/event-bus.js";
import { buildMessage } from "../services/step-delivery.js";

const friends = new Hono<Env>();

type FriendRepo = ReturnType<typeof createFriendRepository>;
type FriendWithTags = NonNullable<Awaited<ReturnType<FriendRepo["findById"]>>>;

/** Convert a repository FriendWithTags to the API response shape */
function serializeFriend(friend: FriendWithTags) {
	return {
		id: friend.id,
		lineUserId: friend.lineUserId,
		displayName: friend.displayName,
		pictureUrl: friend.pictureUrl,
		statusMessage: friend.statusMessage,
		isFollowing: friend.isFollowing,
		metadata: JSON.parse(friend.metadata || "{}"),
		refCode: (friend as unknown as Record<string, unknown>).refCode as string | null,
		userId: friend.userId,
		createdAt: friend.createdAt,
		updatedAt: friend.updatedAt,
	};
}

// GET /api/friends - list with pagination, search, metadata filters
friends.get("/api/friends", async (c) => {
	try {
		const limit = Number(c.req.query("limit") ?? "50");
		const offset = Number(c.req.query("offset") ?? "0");
		const tagId = c.req.query("tagId");
		const lineAccountId = c.req.query("lineAccountId");
		const search = c.req.query("search");

		// Extract metadata.* query params (e.g. ?metadata.plan=pro)
		const metadataFilters: Record<string, string> = {};
		const url = new URL(c.req.url);
		for (const [key, value] of url.searchParams.entries()) {
			if (key.startsWith("metadata.")) {
				const metaKey = key.slice("metadata.".length);
				if (metaKey) metadataFilters[metaKey] = value;
			}
		}

		const db = c.get("db");
		const friendRepo = createFriendRepository(db);

		const page = Math.floor(offset / limit) + 1;
		const result = await friendRepo.listWithTags({
			page,
			limit,
			tagId: tagId as TagId | undefined,
			lineAccountId: lineAccountId as LineAccountId | undefined,
			search: search as string | undefined,
		});

		// Apply metadata filters in-memory using json_extract equivalent
		let filteredItems = result.items;
		const hasMetadataFilters = Object.keys(metadataFilters).length > 0;

		if (hasMetadataFilters) {
			filteredItems = result.items.filter((friend) => {
				const metadata = JSON.parse(friend.metadata || "{}");
				return Object.entries(metadataFilters).every(([key, value]) => String(metadata[key]) === value);
			});
		}

		const itemsWithTags = filteredItems.map((friend) => ({
			...serializeFriend(friend),
			tags: friend.tags,
		}));

		const total = hasMetadataFilters ? filteredItems.length : result.total;

		return c.json({
			success: true,
			data: {
				items: itemsWithTags,
				total,
				page,
				limit,
				hasNextPage: hasMetadataFilters ? false : offset + limit < result.total,
			},
		});
	} catch (err) {
		console.error("GET /api/friends error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/friends/count - friend count (must be before /:id)
friends.get("/api/friends/count", async (c) => {
	try {
		const lineAccountId = c.req.query("lineAccountId");
		const db = c.get("db");
		const friendRepo = createFriendRepository(db);

		let count: number;
		if (lineAccountId) {
			// Count only actively-following friends for a specific account
			const row = await db.get<{ count: number }>(
				sql`SELECT COUNT(*) as count FROM friends WHERE is_following = 1 AND line_account_id = ${lineAccountId}`,
			);
			count = row?.count ?? 0;
		} else {
			count = await friendRepo.count();
		}

		return c.json({ success: true, data: { count } });
	} catch (err) {
		console.error("GET /api/friends/count error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/friends/ref-stats - ref code attribution stats
// NOTE: ref_code is not in the Drizzle schema yet, so we use raw SQL via Drizzle's sql template
friends.get("/api/friends/ref-stats", async (c) => {
	try {
		const lineAccountId = c.req.query("lineAccountId");
		const db = c.get("db");

		// Build ref stats query using Drizzle's raw sql helper
		const statsRows = lineAccountId
			? await db.all<{ ref_code: string; count: number }>(
					sql`SELECT ref_code, COUNT(*) as count FROM friends WHERE line_account_id = ${lineAccountId} AND ref_code IS NOT NULL GROUP BY ref_code ORDER BY count DESC`,
				)
			: await db.all<{ ref_code: string; count: number }>(
					sql`SELECT ref_code, COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL GROUP BY ref_code ORDER BY count DESC`,
				);

		const totalRow = lineAccountId
			? await db.get<{ count: number }>(
					sql`SELECT COUNT(*) as count FROM friends WHERE line_account_id = ${lineAccountId} AND ref_code IS NOT NULL`,
				)
			: await db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL`);

		return c.json({
			success: true,
			data: {
				routes: statsRows.map((r) => ({ refCode: r.ref_code, friendCount: r.count })),
				totalWithRef: totalRow?.count ?? 0,
			},
		});
	} catch (err) {
		console.error("GET /api/friends/ref-stats error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/friends/:id - get single friend with tags
friends.get("/api/friends/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const friendRepo = createFriendRepository(db);

		const friend = await friendRepo.findById(id as FriendId);
		if (!friend) {
			return c.json({ success: false, error: "Friend not found" }, 404);
		}

		return c.json({
			success: true,
			data: {
				...serializeFriend(friend),
				tags: friend.tags,
			},
		});
	} catch (err) {
		console.error("GET /api/friends/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/friends/:id/tags - add tag
friends.post(
	"/api/friends/:id/tags",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(AssignTagSchema),
	async (c) => {
		try {
			const { id: friendId } = c.req.valid("param");
			const body = c.req.valid("json");

			const db = c.get("db");
			const friendRepo = createFriendRepository(db);
			const scenarioRepo = createScenarioRepository(db);

			await friendRepo.assignTag(friendId as FriendId, body.tagId as TagId);

			// Enroll in tag_added scenarios that match this tag
			const allScenarios = await scenarioRepo.list();
			for (const scenario of allScenarios) {
				if (scenario.triggerType === "tag_added" && scenario.isActive && scenario.triggerTagId === body.tagId) {
					// enrollFriend uses onConflictDoNothing, so no need to check existing
					await scenarioRepo.enrollFriend(friendId as FriendId, scenario.id as ScenarioId, null);
				}
			}

			// イベントバス発火: tag_change
			await fireEvent(c.env.DB, "tag_change", { friendId, eventData: { tagId: body.tagId, action: "add" } });

			return c.json({ success: true, data: null }, 201);
		} catch (err) {
			console.error("POST /api/friends/:id/tags error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// DELETE /api/friends/:id/tags/:tagId - remove tag
friends.delete(
	"/api/friends/:id/tags/:tagId",
	validateParam(z.object({ id: UuidSchema, tagId: UuidSchema })),
	async (c) => {
		try {
			const { id: friendId, tagId } = c.req.valid("param");
			const db = c.get("db");
			const friendRepo = createFriendRepository(db);

			await friendRepo.removeTag(friendId as FriendId, tagId as TagId);

			// イベントバス発火: tag_change
			await fireEvent(c.env.DB, "tag_change", { friendId, eventData: { tagId, action: "remove" } });

			return c.json({ success: true, data: null });
		} catch (err) {
			console.error("DELETE /api/friends/:id/tags/:tagId error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// PUT /api/friends/:id/metadata - merge metadata fields
friends.put(
	"/api/friends/:id/metadata",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(FriendMetadataSchema),
	async (c) => {
		try {
			const { id: friendId } = c.req.valid("param");
			const db = c.get("db");
			const friendRepo = createFriendRepository(db);

			const friend = await friendRepo.findById(friendId as FriendId);
			if (!friend) {
				return c.json({ success: false, error: "Friend not found" }, 404);
			}

			const body = c.req.valid("json");
			const existing = JSON.parse(friend.metadata || "{}");
			const merged = { ...existing, ...body };
			const now = DateTime.now().toISO();

			// Update metadata via Drizzle raw SQL since friendRepo doesn't have updateMetadata
			await db.run(
				sql`UPDATE friends SET metadata = ${JSON.stringify(merged)}, updated_at = ${now} WHERE id = ${friendId}`,
			);

			const updated = await friendRepo.findById(friendId as FriendId);
			if (!updated) {
				return c.json({ success: false, error: "Friend not found after update" }, 404);
			}

			return c.json({
				success: true,
				data: {
					...serializeFriend(updated),
					tags: updated.tags,
				},
			});
		} catch (err) {
			console.error("PUT /api/friends/:id/metadata error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// GET /api/friends/:id/messages - get message history
friends.get("/api/friends/:id/messages", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id: friendId } = c.req.valid("param");
		const db = c.get("db");

		const rows = await db.all<{
			id: string;
			direction: string;
			messageType: string;
			content: string;
			createdAt: string;
		}>(
			sql`SELECT id, direction, message_type as "messageType", content, created_at as "createdAt"
            FROM messages_log WHERE friend_id = ${friendId} ORDER BY created_at ASC LIMIT 200`,
		);

		return c.json({ success: true, data: rows });
	} catch (err) {
		console.error("GET /api/friends/:id/messages error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/friends/:id/messages - send message to friend
friends.post(
	"/api/friends/:id/messages",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(SendFriendMessageSchema),
	async (c) => {
		try {
			const { id: friendId } = c.req.valid("param");
			const body = c.req.valid("json");

			const db = c.get("db");
			const friendRepo = createFriendRepository(db);

			const friend = await friendRepo.findById(friendId as FriendId);
			if (!friend) {
				return c.json({ success: false, error: "Friend not found" }, 404);
			}

			const { LineClient } = await import("@line-crm/line-sdk");
			// Resolve access token from friend's account (multi-account support)
			let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
			if (friend.lineAccountId) {
				const { getLineAccountById } = await import("@line-crm/db");
				const account = await getLineAccountById(c.env.DB, friend.lineAccountId);
				if (account) accessToken = account.channel_access_token;
			}
			const lineClient = new LineClient(accessToken);
			const messageType = body.messageType ?? "text";

			// Auto-wrap URLs with tracking links (text with URLs → Flex with button)
			const { autoTrackContent } = await import("../services/auto-track.js");
			const tracked = await autoTrackContent(
				c.env.DB,
				messageType,
				body.content,
				c.env.WORKER_URL || new URL(c.req.url).origin,
			);

			const message = buildMessage(tracked.messageType, tracked.content);
			await lineClient.pushMessage(friend.lineUserId, [message]);

			// Log outgoing message
			const logId = crypto.randomUUID();
			await db.run(
				sql`INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
            VALUES (${logId}, ${friend.id}, 'outgoing', ${messageType}, ${body.content}, NULL, NULL, ${DateTime.now().toISO()})`,
			);

			return c.json({ success: true, data: { messageId: logId } });
		} catch (err) {
			console.error("POST /api/friends/:id/messages error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { friends };
