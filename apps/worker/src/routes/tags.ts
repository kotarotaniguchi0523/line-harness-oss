import { CreateTagSchema, UuidSchema } from "@line-crm/contracts";
import type { Tag as DbTag } from "@line-crm/db";
import { createTag, deleteTag, getTags } from "@line-crm/db";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";
import { CACHE_PREFIX } from "../services/cache.service.js";

const tags = new Hono<Env>();

function serializeTag(row: DbTag) {
	return {
		id: row.id,
		name: row.name,
		color: row.color,
		createdAt: row.created_at,
	};
}

// GET /api/tags - list all tags (cached via KV)
tags.get("/api/tags", async (c) => {
	try {
		const cache = c.get("cache");
		const cacheKey = cache.tags.key("default");
		const items = await cache.getOrFetch(cacheKey, () => getTags(c.env.DB), { ttl: cache.tags.ttl });
		return c.json({ success: true, data: items.map(serializeTag) });
	} catch (err) {
		console.error("GET /api/tags error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/tags - create tag
tags.post("/api/tags", validateJson(CreateTagSchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const tag = await createTag(c.env.DB, {
			name: body.name,
			color: body.color,
		});

		// Invalidate tags cache so subsequent reads pick up the new tag
		const cache = c.get("cache");
		await cache.invalidatePrefix(CACHE_PREFIX.TAGS);

		return c.json({ success: true, data: serializeTag(tag) }, 201);
	} catch (err) {
		console.error("POST /api/tags error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/tags/:id - delete tag
tags.delete("/api/tags/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		await deleteTag(c.env.DB, id);

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
