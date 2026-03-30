import { createWebhookConfigRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const webhooks = new Hono<Env>();

// ========== 受信Webhook ==========

webhooks.get("/api/webhooks/incoming", async (c) => {
	try {
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		const items = await webhookRepo.listIncoming();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/webhooks/incoming error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

webhooks.post("/api/webhooks/incoming", async (c) => {
	try {
		const body = await c.req.json<{ name: string; sourceType?: string; secret?: string }>();
		if (!body.name) return c.json({ success: false, error: "name is required" }, 400);
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		const item = await webhookRepo.createIncoming(body);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/webhooks/incoming error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

webhooks.put("/api/webhooks/incoming/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		await webhookRepo.updateIncoming(id, body);
		const updated = await webhookRepo.findIncomingById(id);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/webhooks/incoming/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

webhooks.delete("/api/webhooks/incoming/:id", async (c) => {
	try {
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		await webhookRepo.deleteIncoming(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/webhooks/incoming/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 送信Webhook ==========

webhooks.get("/api/webhooks/outgoing", async (c) => {
	try {
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		const items = await webhookRepo.listOutgoing();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/webhooks/outgoing error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

webhooks.post("/api/webhooks/outgoing", async (c) => {
	try {
		const body = await c.req.json<{ name: string; url: string; eventTypes: string[]; secret?: string }>();
		if (!(body.name && body.url)) return c.json({ success: false, error: "name and url are required" }, 400);
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		const item = await webhookRepo.createOutgoing({ ...body, eventTypes: body.eventTypes ?? [] });
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/webhooks/outgoing error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

webhooks.put("/api/webhooks/outgoing/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		await webhookRepo.updateOutgoing(id, body);
		const updated = await webhookRepo.findOutgoingById(id);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/webhooks/outgoing/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

webhooks.delete("/api/webhooks/outgoing/:id", async (c) => {
	try {
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		await webhookRepo.deleteOutgoing(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/webhooks/outgoing/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 受信Webhookエンドポイント (外部システムからの受信) ==========

webhooks.post("/api/webhooks/incoming/:id/receive", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const webhookRepo = createWebhookConfigRepository(db);
		const wh = await webhookRepo.findIncomingById(id);
		if (!wh) return c.json({ success: false, error: "Webhook not found or inactive" }, 404);

		const body = await c.req.json();

		// イベントバスに発火: source_type をイベントタイプとして使用
		const { fireEvent } = await import("../services/event-bus.js");
		const eventType = `incoming_webhook.${(wh as unknown as Record<string, unknown>).sourceType ?? "custom"}`;
		await fireEvent(c.env.DB, eventType, {
			eventData: { webhookId: wh.id, source: (wh as unknown as Record<string, unknown>).sourceType, payload: body },
		});

		return c.json({
			success: true,
			data: { received: true, source: (wh as unknown as Record<string, unknown>).sourceType },
		});
	} catch (err) {
		console.error("POST /api/webhooks/incoming/:id/receive error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { webhooks };
