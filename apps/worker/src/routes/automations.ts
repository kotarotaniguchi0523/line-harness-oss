import { createAutomationRepository } from "@line-crm/db";
import type { AutomationId } from "@line-crm/domain";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { CACHE_PREFIX } from "../services/cache.service.js";

const automations = new Hono<Env>();

// ========== 自動化ルールCRUD ==========

automations.get("/api/automations", async (c) => {
	try {
		const db = c.get("db");
		const automationRepo = createAutomationRepository(db);
		const lineAccountId = c.req.query("lineAccountId");
		let items: Awaited<ReturnType<typeof automationRepo.list>>;
		if (lineAccountId) {
			// TODO: Migrate to createAutomationRepository once list() supports lineAccountId filtering
			const result = await c.env.DB.prepare(
				"SELECT * FROM automations WHERE line_account_id = ? ORDER BY priority DESC, created_at DESC",
			)
				.bind(lineAccountId)
				.all();
			items = result.results as unknown as Awaited<ReturnType<typeof automationRepo.list>>;
		} else {
			items = await automationRepo.list();
		}
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/automations error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

automations.get("/api/automations/:id", async (c) => {
	try {
		const db = c.get("db");
		const automationRepo = createAutomationRepository(db);
		const item = await automationRepo.findById(c.req.param("id") as AutomationId);
		if (!item) return c.json({ success: false, error: "Automation not found" }, 404);

		const logs = await automationRepo.getLogs(c.req.param("id") as AutomationId, 50);

		return c.json({
			success: true,
			data: {
				...item,
				logs,
			},
		});
	} catch (err) {
		console.error("GET /api/automations/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

automations.post("/api/automations", async (c) => {
	try {
		const body = await c.req.json<{
			name: string;
			description?: string;
			eventType: string;
			conditions?: Record<string, unknown>;
			actions: unknown[];
			priority?: number;
			lineAccountId?: string | null;
		}>();
		if (!(body.name && body.eventType && body.actions)) {
			return c.json({ success: false, error: "name, eventType, actions are required" }, 400);
		}
		const db = c.get("db");
		const automationRepo = createAutomationRepository(db);
		const id = await automationRepo.create({
			name: body.name,
			description: body.description,
			eventType: body.eventType,
			conditions: body.conditions ? JSON.stringify(body.conditions) : "{}",
			actions: JSON.stringify(body.actions),
			priority: body.priority,
		});
		// Save line_account_id if provided
		if (body.lineAccountId) {
			await c.env.DB.prepare("UPDATE automations SET line_account_id = ? WHERE id = ?")
				.bind(body.lineAccountId, id)
				.run();
		}

		// Invalidate automations cache after creation
		const cache = c.get("cache");
		await cache.invalidatePrefix(CACHE_PREFIX.AUTOMATIONS);

		const item = await automationRepo.findById(id as AutomationId);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/automations error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

automations.put("/api/automations/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		const db = c.get("db");
		const automationRepo = createAutomationRepository(db);
		await automationRepo.update(id as AutomationId, body);
		const updated = await automationRepo.findById(id as AutomationId);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);

		// Invalidate automations cache after update
		const cacheForUpdate = c.get("cache");
		await cacheForUpdate.invalidatePrefix(CACHE_PREFIX.AUTOMATIONS);

		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/automations/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

automations.delete("/api/automations/:id", async (c) => {
	try {
		const db = c.get("db");
		const automationRepo = createAutomationRepository(db);
		await automationRepo.delete(c.req.param("id") as AutomationId);

		// Invalidate automations cache after deletion
		const cache = c.get("cache");
		await cache.invalidatePrefix(CACHE_PREFIX.AUTOMATIONS);

		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/automations/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 自動化ログ ==========

automations.get("/api/automations/:id/logs", async (c) => {
	try {
		const automationId = c.req.param("id");
		const limit = Number(c.req.query("limit") ?? "100");
		const db = c.get("db");
		const automationRepo = createAutomationRepository(db);
		const logs = await automationRepo.getLogs(automationId as AutomationId, limit);
		return c.json({ success: true, data: logs });
	} catch (err) {
		console.error("GET /api/automations/:id/logs error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { automations };
