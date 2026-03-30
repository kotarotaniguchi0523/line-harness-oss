import { createConversionRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const conversions = new Hono<Env>();

// ── Conversion Points ───────────────────────────────────────────────────────

// GET /api/conversions/points - list all
conversions.get("/api/conversions/points", async (c) => {
	try {
		const db = c.get("db");
		const conversionRepo = createConversionRepository(db);
		const items = await conversionRepo.listPoints();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/conversions/points error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/conversions/points - create
conversions.post("/api/conversions/points", async (c) => {
	try {
		const body = await c.req.json<{
			name: string;
			eventType: string;
			value?: number | null;
		}>();

		if (!(body.name && body.eventType)) {
			return c.json({ success: false, error: "name and eventType are required" }, 400);
		}

		const db = c.get("db");
		const conversionRepo = createConversionRepository(db);
		const point = await conversionRepo.createPoint(body);
		return c.json({ success: true, data: point }, 201);
	} catch (err) {
		console.error("POST /api/conversions/points error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/conversions/points/:id - delete
conversions.delete("/api/conversions/points/:id", async (c) => {
	try {
		const db = c.get("db");
		const conversionRepo = createConversionRepository(db);
		await conversionRepo.deletePoint(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/conversions/points/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ── Conversion Tracking ─────────────────────────────────────────────────────

// POST /api/conversions/track - record conversion
conversions.post("/api/conversions/track", async (c) => {
	try {
		const body = await c.req.json<{
			conversionPointId: string;
			friendId: string;
			userId?: string | null;
			affiliateCode?: string | null;
			metadata?: Record<string, unknown> | null;
		}>();

		if (!(body.conversionPointId && body.friendId)) {
			return c.json({ success: false, error: "conversionPointId and friendId are required" }, 400);
		}

		const db = c.get("db");
		const conversionRepo = createConversionRepository(db);
		const id = await conversionRepo.track({
			conversionPointId: body.conversionPointId,
			friendId: body.friendId,
			userId: body.userId ?? undefined,
			affiliateCode: body.affiliateCode ?? undefined,
			metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
		});
		// Return success with the created ID
		return c.json({ success: true, data: { id } }, 201);
	} catch (err) {
		console.error("POST /api/conversions/track error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/conversions/events - list events with filters
conversions.get("/api/conversions/events", async (c) => {
	try {
		const db = c.get("db");
		const conversionRepo = createConversionRepository(db);
		const events = await conversionRepo.getEvents({
			conversionPointId: c.req.query("conversionPointId"),
			friendId: c.req.query("friendId"),
			affiliateCode: c.req.query("affiliateCode"),
			startDate: c.req.query("startDate"),
			endDate: c.req.query("endDate"),
			limit: Number(c.req.query("limit") ?? "100"),
			offset: Number(c.req.query("offset") ?? "0"),
		});

		return c.json({ success: true, data: events });
	} catch (err) {
		console.error("GET /api/conversions/events error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/conversions/report - aggregated report
conversions.get("/api/conversions/report", async (c) => {
	try {
		const db = c.get("db");
		const conversionRepo = createConversionRepository(db);
		const report = await conversionRepo.getReport({
			startDate: c.req.query("startDate"),
			endDate: c.req.query("endDate"),
		});

		return c.json({ success: true, data: report });
	} catch (err) {
		console.error("GET /api/conversions/report error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { conversions };
