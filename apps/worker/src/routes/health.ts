import { createHealthRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const health = new Hono<Env>();

// ========== アカウントヘルス ==========

health.get("/api/accounts/:id/health", async (c) => {
	try {
		const lineAccountId = c.req.param("id");
		const db = c.get("db");
		const healthRepo = createHealthRepository(db);
		const [riskLevel, logs] = await Promise.all([
			healthRepo.getLatestRiskLevel(lineAccountId),
			healthRepo.getLogs(lineAccountId),
		]);
		return c.json({
			success: true,
			data: {
				lineAccountId,
				riskLevel,
				logs,
			},
		});
	} catch (err) {
		console.error("GET /api/accounts/:id/health error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== アカウント移行 ==========

health.get("/api/accounts/migrations", async (c) => {
	try {
		const db = c.get("db");
		const healthRepo = createHealthRepository(db);
		const items = await healthRepo.listMigrations();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/accounts/migrations error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

health.post("/api/accounts/:id/migrate", async (c) => {
	try {
		const fromAccountId = c.req.param("id");
		const body = await c.req.json<{ toAccountId: string }>();
		if (!body.toAccountId) return c.json({ success: false, error: "toAccountId is required" }, 400);

		// 移行対象: このアカウントに紐づく友だち数をカウント（簡易版）
		// TODO: Migrate to createFriendRepository once count() supports isFollowing filter
		const countResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM friends WHERE is_following = 1").first<{
			count: number;
		}>();
		const totalCount = countResult?.count ?? 0;

		const db = c.get("db");
		const healthRepo = createHealthRepository(db);
		const migration = await healthRepo.createMigration({
			fromAccountId,
			toAccountId: body.toAccountId,
			totalCount,
		});

		// 移行処理は非同期で実行
		await healthRepo.updateMigration(migration.id, { status: "in_progress" });

		const updated = await healthRepo.findMigrationById(migration.id);
		return c.json({ success: true, data: updated ?? migration }, 201);
	} catch (err) {
		console.error("POST /api/accounts/:id/migrate error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

health.get("/api/accounts/migrations/:migrationId", async (c) => {
	try {
		const db = c.get("db");
		const healthRepo = createHealthRepository(db);
		const item = await healthRepo.findMigrationById(c.req.param("migrationId"));
		if (!item) return c.json({ success: false, error: "Migration not found" }, 404);
		return c.json({ success: true, data: item });
	} catch (err) {
		console.error("GET /api/accounts/migrations/:migrationId error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { health };
