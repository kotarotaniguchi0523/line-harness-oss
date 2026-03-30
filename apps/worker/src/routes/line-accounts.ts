import { createLineAccountRepository } from "@line-crm/db";
import type { LineAccountId } from "@line-crm/domain";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { requireRole } from "../middleware/role-guard.js";
import { CACHE_PREFIX } from "../services/cache.service.js";

const lineAccounts = new Hono<Env>();

// Fetch bot profile (displayName, pictureUrl) from LINE API
async function fetchBotProfile(
	accessToken: string,
): Promise<{ displayName?: string; pictureUrl?: string; basicId?: string }> {
	try {
		const res = await fetch("https://api.line.me/v2/bot/info", {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!res.ok) return {};
		const data = (await res.json()) as { displayName?: string; pictureUrl?: string; basicId?: string };
		return { displayName: data.displayName, pictureUrl: data.pictureUrl, basicId: data.basicId };
	} catch {
		return {};
	}
}

// GET /api/line-accounts - list all (with LINE profile + stats)
lineAccounts.get("/api/line-accounts", async (c) => {
	try {
		const db = c.get("db");
		const accountRepo = createLineAccountRepository(db);
		const items = await accountRepo.list();

		// Get stats for all accounts in parallel
		const results = await Promise.all(
			items.map(async (item) => {
				// TODO: Migrate stats queries to repository methods (line_accounts stats: friend count, active scenarios, messages)
				const [profile, friendCount, scenarioCount, msgCount] = await Promise.all([
					fetchBotProfile(item.channelAccessToken),
					c.env.DB.prepare("SELECT COUNT(*) as count FROM friends WHERE is_following = 1 AND line_account_id = ?")
						.bind(item.id)
						.first<{ count: number }>(),
					c.env.DB.prepare(
						`SELECT COUNT(*) as count FROM friend_scenarios fs
             INNER JOIN friends f ON f.id = fs.friend_id
             WHERE fs.status = 'active' AND f.line_account_id = ?`,
					)
						.bind(item.id)
						.first<{ count: number }>(),
					c.env.DB.prepare(
						`SELECT COUNT(*) as count FROM messages_log ml
             INNER JOIN friends f ON f.id = ml.friend_id
             WHERE ml.direction = 'outgoing' AND (ml.delivery_type IS NULL OR ml.delivery_type = 'push') AND ml.created_at >= date('now', '-30 days') AND f.line_account_id = ?`,
					)
						.bind(item.id)
						.first<{ count: number }>(),
				]);

				return {
					id: item.id,
					channelId: item.channelId,
					name: item.name,
					isActive: item.isActive,
					createdAt: item.createdAt,
					updatedAt: item.updatedAt,
					displayName: profile.displayName || item.name,
					pictureUrl: profile.pictureUrl || null,
					basicId: profile.basicId || null,
					stats: {
						friendCount: friendCount?.count ?? 0,
						activeScenarios: scenarioCount?.count ?? 0,
						messagesThisMonth: msgCount?.count ?? 0,
					},
				};
			}),
		);
		return c.json({ success: true, data: results });
	} catch (err) {
		console.error("GET /api/line-accounts error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/line-accounts/:id - get single (secrets only for owner/admin)
lineAccounts.get("/api/line-accounts/:id", async (c) => {
	try {
		const db = c.get("db");
		const accountRepo = createLineAccountRepository(db);
		const account = await accountRepo.findById(c.req.param("id") as LineAccountId);
		if (!account) {
			return c.json({ success: false, error: "LINE account not found" }, 404);
		}
		const staffCtx = c.get("staff");
		const data =
			staffCtx?.role === "staff"
				? {
						id: account.id,
						channelId: account.channelId,
						name: account.name,
						isActive: account.isActive,
						createdAt: account.createdAt,
						updatedAt: account.updatedAt,
					}
				: account;
		return c.json({ success: true, data });
	} catch (err) {
		console.error("GET /api/line-accounts/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/line-accounts - create
lineAccounts.post("/api/line-accounts", requireRole("owner"), async (c) => {
	try {
		const body = await c.req.json<{
			channelId: string;
			name: string;
			channelAccessToken: string;
			channelSecret: string;
		}>();

		if (!(body.channelId && body.name && body.channelAccessToken && body.channelSecret)) {
			return c.json(
				{ success: false, error: "channelId, name, channelAccessToken, and channelSecret are required" },
				400,
			);
		}

		const db = c.get("db");
		const accountRepo = createLineAccountRepository(db);
		const id = await accountRepo.create(body);
		const account = await accountRepo.findById(id as LineAccountId);

		// Invalidate line account cache after creation
		const cache = c.get("cache");
		await cache.invalidatePrefix(CACHE_PREFIX.LINE_ACCOUNT);

		return c.json({ success: true, data: account }, 201);
	} catch (err) {
		console.error("POST /api/line-accounts error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/line-accounts/:id - update
lineAccounts.put("/api/line-accounts/:id", requireRole("owner"), async (c) => {
	try {
		const id = c.req.param("id") as string;
		const body = await c.req.json<{
			name?: string;
			channelAccessToken?: string;
			channelSecret?: string;
			isActive?: boolean;
		}>();

		const db = c.get("db");
		const accountRepo = createLineAccountRepository(db);
		await accountRepo.update(id as LineAccountId, {
			name: body.name,
			channelAccessToken: body.channelAccessToken,
			channelSecret: body.channelSecret,
			isActive: body.isActive,
		});

		const updated = await accountRepo.findById(id as LineAccountId);
		if (!updated) {
			return c.json({ success: false, error: "LINE account not found" }, 404);
		}

		// Invalidate line account cache after update
		const cacheForUpdate = c.get("cache");
		await cacheForUpdate.invalidate(cacheForUpdate.lineAccount.key(id));
		await cacheForUpdate.invalidatePrefix(CACHE_PREFIX.LINE_ACCOUNT);

		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/line-accounts/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/line-accounts/:id - delete
lineAccounts.delete("/api/line-accounts/:id", requireRole("owner"), async (c) => {
	try {
		const deleteId = c.req.param("id") as string;
		const db = c.get("db");
		const accountRepo = createLineAccountRepository(db);
		await accountRepo.delete(deleteId as LineAccountId);

		// Invalidate line account cache after deletion
		const cache = c.get("cache");
		await cache.invalidate(cache.lineAccount.key(deleteId));
		await cache.invalidatePrefix(CACHE_PREFIX.LINE_ACCOUNT);

		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/line-accounts/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { lineAccounts };
