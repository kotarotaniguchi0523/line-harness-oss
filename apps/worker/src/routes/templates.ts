import { createTemplateRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const templates = new Hono<Env>();

templates.get("/api/templates", async (c) => {
	try {
		const db = c.get("db");
		const templateRepo = createTemplateRepository(db);
		const category = c.req.query("category") ?? undefined;
		const items = await templateRepo.list(category);
		return c.json({
			success: true,
			data: items,
		});
	} catch (err) {
		console.error("GET /api/templates error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

templates.get("/api/templates/:id", async (c) => {
	try {
		const db = c.get("db");
		const templateRepo = createTemplateRepository(db);
		const item = await templateRepo.findById(c.req.param("id"));
		if (!item) return c.json({ success: false, error: "Template not found" }, 404);
		return c.json({ success: true, data: item });
	} catch (err) {
		console.error("GET /api/templates/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

templates.post("/api/templates", async (c) => {
	try {
		const body = await c.req.json<{ name: string; category?: string; messageType: string; messageContent: string }>();
		if (!(body.name && body.messageType && body.messageContent)) {
			return c.json({ success: false, error: "name, messageType, messageContent are required" }, 400);
		}
		const db = c.get("db");
		const templateRepo = createTemplateRepository(db);
		const item = await templateRepo.create(body);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/templates error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

templates.put("/api/templates/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		const db = c.get("db");
		const templateRepo = createTemplateRepository(db);
		await templateRepo.update(id, body);
		const updated = await templateRepo.findById(id);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/templates/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

templates.delete("/api/templates/:id", async (c) => {
	try {
		const db = c.get("db");
		const templateRepo = createTemplateRepository(db);
		await templateRepo.delete(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/templates/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { templates };
