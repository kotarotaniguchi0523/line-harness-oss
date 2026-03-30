import { createAffiliateRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const affiliates = new Hono<Env>();

// GET /api/affiliates - list all
affiliates.get("/api/affiliates", async (c) => {
	try {
		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		const items = await affiliateRepo.list();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/affiliates error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/affiliates/:id - get single
affiliates.get("/api/affiliates/:id", async (c) => {
	try {
		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		const item = await affiliateRepo.findById(c.req.param("id"));
		if (!item) {
			return c.json({ success: false, error: "Affiliate not found" }, 404);
		}
		return c.json({ success: true, data: item });
	} catch (err) {
		console.error("GET /api/affiliates/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/affiliates - create
affiliates.post("/api/affiliates", async (c) => {
	try {
		const body = await c.req.json<{
			name: string;
			code: string;
			commissionRate?: number;
		}>();

		if (!(body.name && body.code)) {
			return c.json({ success: false, error: "name and code are required" }, 400);
		}

		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		const item = await affiliateRepo.create(body);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/affiliates error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/affiliates/:id - update
affiliates.put("/api/affiliates/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json<{
			name?: string;
			commissionRate?: number;
			isActive?: boolean;
		}>();

		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		await affiliateRepo.update(id, {
			name: body.name,
			commissionRate: body.commissionRate,
			isActive: body.isActive,
		});

		const updated = await affiliateRepo.findById(id);
		if (!updated) {
			return c.json({ success: false, error: "Affiliate not found" }, 404);
		}
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/affiliates/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/affiliates/:id - delete
affiliates.delete("/api/affiliates/:id", async (c) => {
	try {
		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		await affiliateRepo.delete(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/affiliates/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/affiliates/:id/report - affiliate performance report
affiliates.get("/api/affiliates/:id/report", async (c) => {
	try {
		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		const report = await affiliateRepo.getReport(c.req.param("id"));
		return c.json({ success: true, data: report });
	} catch (err) {
		console.error("GET /api/affiliates/:id/report error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/affiliates/click - record click (public endpoint tracked by ref param)
affiliates.post("/api/affiliates/click", async (c) => {
	try {
		const body = await c.req.json<{
			code: string;
			url?: string | null;
		}>();

		if (!body.code) {
			return c.json({ success: false, error: "code is required" }, 400);
		}

		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		const affiliate = await affiliateRepo.findByCode(body.code);
		if (!affiliate) {
			return c.json({ success: false, error: "Affiliate not found" }, 404);
		}

		const ipAddress = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;
		await affiliateRepo.recordClick(affiliate.id, body.url, ipAddress);
		return c.json({ success: true, data: null }, 201);
	} catch (err) {
		console.error("POST /api/affiliates/click error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/affiliates-report - all affiliates report
affiliates.get("/api/affiliates-report", async (c) => {
	try {
		const db = c.get("db");
		const affiliateRepo = createAffiliateRepository(db);
		const report = await affiliateRepo.getReport();
		return c.json({ success: true, data: report });
	} catch (err) {
		console.error("GET /api/affiliates-report error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { affiliates };
