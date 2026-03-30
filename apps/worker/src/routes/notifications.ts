import { createNotificationRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const notifications = new Hono<Env>();

// ========== 通知ルールCRUD ==========

notifications.get("/api/notifications/rules", async (c) => {
	try {
		const db = c.get("db");
		const notifRepo = createNotificationRepository(db);
		const lineAccountId = c.req.query("lineAccountId");
		let items: Awaited<ReturnType<typeof notifRepo.listRules>>;
		if (lineAccountId) {
			// TODO: Migrate to notification_rules repository once listRules() supports lineAccountId filtering
			const result = await c.env.DB.prepare(
				"SELECT * FROM notification_rules WHERE line_account_id = ? ORDER BY created_at DESC",
			)
				.bind(lineAccountId)
				.all();
			items = result.results as unknown as Awaited<ReturnType<typeof notifRepo.listRules>>;
		} else {
			items = await notifRepo.listRules();
		}
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/notifications/rules error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

notifications.get("/api/notifications/rules/:id", async (c) => {
	try {
		const db = c.get("db");
		const notifRepo = createNotificationRepository(db);
		const item = await notifRepo.findRuleById(c.req.param("id"));
		if (!item) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: item });
	} catch (err) {
		console.error("GET /api/notifications/rules/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

notifications.post("/api/notifications/rules", async (c) => {
	try {
		const body = await c.req.json<{
			name: string;
			eventType: string;
			conditions?: Record<string, unknown>;
			channels?: string[];
		}>();
		if (!(body.name && body.eventType))
			return c.json({ success: false, error: "name and eventType are required" }, 400);
		const db = c.get("db");
		const notifRepo = createNotificationRepository(db);
		const id = await notifRepo.createRule(body);
		const item = await notifRepo.findRuleById(id);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/notifications/rules error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

notifications.put("/api/notifications/rules/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		const db = c.get("db");
		const notifRepo = createNotificationRepository(db);
		await notifRepo.updateRule(id, body);
		const updated = await notifRepo.findRuleById(id);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/notifications/rules/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

notifications.delete("/api/notifications/rules/:id", async (c) => {
	try {
		const db = c.get("db");
		const notifRepo = createNotificationRepository(db);
		await notifRepo.deleteRule(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/notifications/rules/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 通知一覧 ==========

notifications.get("/api/notifications", async (c) => {
	try {
		const status = c.req.query("status") ?? undefined;
		const limit = Number(c.req.query("limit") ?? "100");
		const lineAccountId = c.req.query("lineAccountId") ?? undefined;
		const db = c.get("db");
		const notifRepo = createNotificationRepository(db);

		let items: Awaited<ReturnType<typeof notifRepo.listNotifications>>;
		if (lineAccountId) {
			// TODO: Migrate to notifications repository once available (no Drizzle repo exists for notifications)
			const conditions: string[] = ["line_account_id = ?"];
			const bindings: unknown[] = [lineAccountId];
			if (status) {
				conditions.push("status = ?");
				bindings.push(status);
			}
			bindings.push(limit);
			const result = await c.env.DB.prepare(
				`SELECT * FROM notifications WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
			)
				.bind(...bindings)
				.all();
			items = result.results as unknown as Awaited<ReturnType<typeof notifRepo.listNotifications>>;
		} else {
			items = await notifRepo.listNotifications({ status, limit });
		}
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/notifications error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { notifications };
