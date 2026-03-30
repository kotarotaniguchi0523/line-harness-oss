import { CreateTagSchema, UuidSchema } from "@line-crm/contracts";
import { createTagRepository } from "@line-crm/db";
import type { TagId } from "@line-crm/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";
import { CACHE_PREFIX } from "../services/cache.service.js";

const tags = new Hono<Env>();

// GET /api/tags - list all tags (cached via KV)
tags.get("/api/tags", async (c) => {
	try {
		const db = c.get("db");
		const tagRepo = createTagRepository(db);
		const cache = c.get("cache");
		const cacheKey = cache.tags.key("default");
		const items = await cache.getOrFetch(cacheKey, () => tagRepo.list(), { ttl: cache.tags.ttl });
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/tags error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/tags - create tag
tags.post("/api/tags", validateJson(CreateTagSchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const db = c.get("db");
		const tagRepo = createTagRepository(db);
		const id = await tagRepo.create({
			name: body.name,
			color: body.color,
		});

		// Invalidate tags cache so subsequent reads pick up the new tag
		const cache = c.get("cache");
		await cache.invalidatePrefix(CACHE_PREFIX.TAGS);

		const tag = await tagRepo.findById(id as TagId);
		return c.json({ success: true, data: tag }, 201);
	} catch (err) {
		console.error("POST /api/tags error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/tags/:id - delete tag
tags.delete("/api/tags/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const tagRepo = createTagRepository(db);
		await tagRepo.delete(id as TagId);

		// Invalidate tags cache after deletion
		const cache = c.get("cache");
		await cache.invalidatePrefix(CACHE_PREFIX.TAGS);

		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/tags/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { tags };
