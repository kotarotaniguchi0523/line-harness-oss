import { type CreateTrackedLinkRequest, CreateTrackedLinkSchema } from "@line-crm/contracts";
import {
	createFriendRepository,
	createScenarioRepository,
	createTagRepository,
	createTrackedLinkRepository,
} from "@line-crm/db";
import type { FriendId, LineUserId, ScenarioId, TagId } from "@line-crm/domain";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { validateJson } from "../middleware/validate.js";

const LINE_APP_UA_PATTERN = /\bLine\b/i;

const trackedLinks = new Hono<Env>();

function getBaseUrl(c: { req: { url: string } }): string {
	const url = new URL(c.req.url);
	return `${url.protocol}//${url.host}`;
}

// GET /api/tracked-links — list all
trackedLinks.get("/api/tracked-links", async (c) => {
	try {
		const db = c.get("db");
		const linkRepo = createTrackedLinkRepository(db);
		const items = await linkRepo.list();
		const base = getBaseUrl(c);
		return c.json({
			success: true,
			data: items.map((item) => ({
				...item,
				trackingUrl: `${base}/t/${item.id}`,
			})),
		});
	} catch (err) {
		console.error("GET /api/tracked-links error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/tracked-links/:id — get single with click details
trackedLinks.get("/api/tracked-links/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const linkRepo = createTrackedLinkRepository(db);
		const link = await linkRepo.findById(id);
		if (!link) {
			return c.json({ success: false, error: "Tracked link not found" }, 404);
		}
		const clicks = await linkRepo.getClicks(id);
		const base = getBaseUrl(c);
		return c.json({
			success: true,
			data: {
				...link,
				trackingUrl: `${base}/t/${link.id}`,
				clicks,
			},
		});
	} catch (err) {
		console.error("GET /api/tracked-links/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/tracked-links — create
trackedLinks.post("/api/tracked-links", validateJson(CreateTrackedLinkSchema), async (c) => {
	try {
		const body: CreateTrackedLinkRequest = c.req.valid("json");
		const db = c.get("db");
		const linkRepo = createTrackedLinkRepository(db);

		const id = await linkRepo.create({
			name: body.name,
			originalUrl: body.originalUrl,
			tagId: body.tagId ?? null,
			scenarioId: body.scenarioId ?? null,
		});

		const link = await linkRepo.findById(id);
		const base = getBaseUrl(c);
		return c.json({ success: true, data: { ...link, trackingUrl: `${base}/t/${id}` } }, 201);
	} catch (err) {
		console.error("POST /api/tracked-links error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/tracked-links/:id
trackedLinks.delete("/api/tracked-links/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const linkRepo = createTrackedLinkRepository(db);
		const link = await linkRepo.findById(id);
		if (!link) {
			return c.json({ success: false, error: "Tracked link not found" }, 404);
		}
		await linkRepo.delete(id);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/tracked-links/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /t/:linkId — click tracking redirect (no auth, fast redirect)
trackedLinks.get("/t/:linkId", async (c) => {
	const linkId = c.req.param("linkId");
	const lineUserId = c.req.query("lu") ?? null;
	let friendId = c.req.query("f") ?? null;

	const db = c.get("db");
	const linkRepo = createTrackedLinkRepository(db);

	// Look up the link first
	const link = await linkRepo.findById(linkId);
	const linkRecord = link as unknown as Record<string, unknown>;

	if (!(link && (linkRecord.isActive ?? linkRecord.is_active))) {
		return c.json({ success: false, error: "Link not found" }, 404);
	}

	// If no user ID yet, check if this is LINE's in-app browser → redirect to LIFF for identification
	const ua = c.req.header("user-agent") || "";
	const isLineApp = LINE_APP_UA_PATTERN.test(ua);
	if (!(lineUserId || friendId) && isLineApp && c.env.LIFF_URL) {
		const directUrl = `${c.env.WORKER_URL || new URL(c.req.url).origin}/t/${linkId}`;
		const liffRedirect = `${c.env.LIFF_URL}?redirect=${encodeURIComponent(directUrl)}`;
		return c.redirect(liffRedirect, 302);
	}

	// Resolve friendId from LINE user ID if provided
	if (!friendId && lineUserId) {
		const friendRepo = createFriendRepository(db);
		const friend = await friendRepo.findByLineUserId(lineUserId as LineUserId);
		if (friend) {
			friendId = friend.id;
		}
	}

	// Redirect immediately, run side-effects async
	const ctx = c.executionCtx as ExecutionContext;
	ctx.waitUntil(
		(async () => {
			try {
				// Record the click
				await linkRepo.recordClick(linkId, friendId);

				// Run automatic actions if a friend is identified
				if (friendId) {
					const actions: Promise<unknown>[] = [];
					const tagId = linkRecord.tagId ?? linkRecord.tag_id;
					const scenarioId = linkRecord.scenarioId ?? linkRecord.scenario_id;

					if (tagId) {
						const tagRepo = createTagRepository(db);
						actions.push(tagRepo.assignToFriend(friendId as FriendId, tagId as TagId));
					}

					if (scenarioId) {
						const scenarioRepo = createScenarioRepository(db);
						actions.push(scenarioRepo.enrollFriend(friendId as FriendId, scenarioId as ScenarioId, null));
					}

					if (actions.length > 0) {
						await Promise.allSettled(actions);
					}
				}
			} catch (err) {
				console.error(`/t/${linkId} async tracking error:`, err);
			}
		})(),
	);

	return c.redirect((linkRecord.originalUrl ?? linkRecord.original_url) as string, 302);
});

export { trackedLinks };
