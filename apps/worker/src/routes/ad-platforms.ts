import { MIDDLEWARE_LIMITS } from "@line-crm/contracts";
import { createAdPlatformRepository } from "@line-crm/db";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import type { Env } from "../index.js";
import { sendAdConversions } from "../services/ad-conversion.js";

const adPlatforms = new Hono<Env>();

// Apply timeout to all ad platform routes (calls external ad APIs)
adPlatforms.use("*", timeout(MIDDLEWARE_LIMITS.externalApiTimeoutMs));

// GET /api/ad-platforms - list all
adPlatforms.get("/api/ad-platforms", async (c) => {
	try {
		const db = c.get("db");
		const adPlatformRepo = createAdPlatformRepository(db);
		const items = await adPlatformRepo.list();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/ad-platforms error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/ad-platforms - create
adPlatforms.post("/api/ad-platforms", async (c) => {
	try {
		const body = await c.req.json<{
			name: string;
			displayName?: string;
			config: Record<string, unknown>;
		}>();

		if (!(body.name && body.config)) {
			return c.json({ success: false, error: "name and config are required" }, 400);
		}

		const validNames = ["meta", "x", "google", "tiktok"];
		if (!validNames.includes(body.name)) {
			return c.json({ success: false, error: `name must be one of: ${validNames.join(", ")}` }, 400);
		}

		const db = c.get("db");
		const adPlatformRepo = createAdPlatformRepository(db);
		const id = await adPlatformRepo.create({
			name: body.name,
			displayName: body.displayName,
			config: body.config,
		});
		const platform = await adPlatformRepo.findById(id);
		return c.json({ success: true, data: platform }, 201);
	} catch (err) {
		console.error("POST /api/ad-platforms error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/ad-platforms/:id - update
adPlatforms.put("/api/ad-platforms/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json<{
			name?: string;
			displayName?: string | null;
			config?: Record<string, unknown>;
			isActive?: boolean;
		}>();

		const db = c.get("db");
		const adPlatformRepo = createAdPlatformRepository(db);
		await adPlatformRepo.update(id, body);
		const platform = await adPlatformRepo.findById(id);
		if (!platform) {
			return c.json({ success: false, error: "Not found" }, 404);
		}

		return c.json({ success: true, data: platform });
	} catch (err) {
		console.error("PUT /api/ad-platforms/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/ad-platforms/test - test conversion send (must be before :id routes)
adPlatforms.post("/api/ad-platforms/test", async (c) => {
	try {
		const body = await c.req.json<{
			platform: string;
			eventName: string;
			friendId?: string;
		}>();

		if (!(body.platform && body.eventName)) {
			return c.json({ success: false, error: "platform and eventName are required" }, 400);
		}

		const db = c.get("db");
		const adPlatformRepo = createAdPlatformRepository(db);
		const platform = await adPlatformRepo.findByName(body.platform);
		if (!platform) {
			return c.json({ success: false, error: `Platform "${body.platform}" not found or inactive` }, 404);
		}

		if (body.friendId) {
			await sendAdConversions(c.env.DB, body.friendId, body.eventName);
			return c.json({ success: true, data: { message: "Test conversion sent via full pipeline" } });
		}

		return c.json({
			success: true,
			data: {
				message: `Platform "${body.platform}" is configured and active. Provide friendId to send a test conversion.`,
			},
		});
	} catch (err) {
		console.error("POST /api/ad-platforms/test error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/ad-platforms/:id - delete
adPlatforms.delete("/api/ad-platforms/:id", async (c) => {
	try {
		const db = c.get("db");
		const adPlatformRepo = createAdPlatformRepository(db);
		await adPlatformRepo.delete(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/ad-platforms/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/ad-platforms/:id/logs - conversion send logs
adPlatforms.get("/api/ad-platforms/:id/logs", async (c) => {
	try {
		const id = c.req.param("id");
		const limit = Number(c.req.query("limit") ?? "50");
		const db = c.get("db");
		const adPlatformRepo = createAdPlatformRepository(db);
		const logs = await adPlatformRepo.getConversionLogs(id, limit);
		return c.json({ success: true, data: logs });
	} catch (err) {
		console.error("GET /api/ad-platforms/:id/logs error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { adPlatforms };
