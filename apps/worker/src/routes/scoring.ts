import { AddScoreSchema, CreateScoringRuleSchema, UpdateScoringRuleSchema, UuidSchema } from "@line-crm/contracts";
import { createScoringRepository } from "@line-crm/db";
import type { FriendId, ScoringRuleId } from "@line-crm/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";

const scoring = new Hono<Env>();

// ========== スコアリングルールCRUD ==========

scoring.get("/api/scoring-rules", async (c) => {
	try {
		const db = c.get("db");
		const scoringRepo = createScoringRepository(db);
		const items = await scoringRepo.listRules();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/scoring-rules error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

scoring.get("/api/scoring-rules/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const scoringRepo = createScoringRepository(db);
		const item = await scoringRepo.findRuleById(id as ScoringRuleId);
		if (!item) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: item });
	} catch (err) {
		console.error("GET /api/scoring-rules/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

scoring.post("/api/scoring-rules", validateJson(CreateScoringRuleSchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const db = c.get("db");
		const scoringRepo = createScoringRepository(db);
		const id = await scoringRepo.createRule(body);
		const item = await scoringRepo.findRuleById(id as ScoringRuleId);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/scoring-rules error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

scoring.put(
	"/api/scoring-rules/:id",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(UpdateScoringRuleSchema),
	async (c) => {
		try {
			const { id } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const scoringRepo = createScoringRepository(db);
			await scoringRepo.updateRule(id as ScoringRuleId, body);
			const updated = await scoringRepo.findRuleById(id as ScoringRuleId);
			if (!updated) return c.json({ success: false, error: "Not found" }, 404);
			return c.json({ success: true, data: updated });
		} catch (err) {
			console.error("PUT /api/scoring-rules/:id error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

scoring.delete("/api/scoring-rules/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const scoringRepo = createScoringRepository(db);
		await scoringRepo.deleteRule(id as ScoringRuleId);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/scoring-rules/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 友だちスコア ==========

scoring.get("/api/friends/:id/score", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id: friendId } = c.req.valid("param");
		const db = c.get("db");
		const scoringRepo = createScoringRepository(db);
		const [score, history] = await Promise.all([
			scoringRepo.getFriendScore(friendId as FriendId),
			scoringRepo.getScoreHistory(friendId as FriendId),
		]);
		return c.json({
			success: true,
			data: {
				friendId,
				currentScore: score,
				history,
			},
		});
	} catch (err) {
		console.error("GET /api/friends/:id/score error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// 手動スコア加算
scoring.post(
	"/api/friends/:id/score",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(AddScoreSchema),
	async (c) => {
		try {
			const { id: friendId } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const scoringRepo = createScoringRepository(db);
			await scoringRepo.addScore({
				friendId: friendId as FriendId,
				scoreChange: body.scoreChange,
				reason: body.reason,
			});
			const newScore = await scoringRepo.getFriendScore(friendId as FriendId);
			return c.json({ success: true, data: { friendId, currentScore: newScore } }, 201);
		} catch (err) {
			console.error("POST /api/friends/:id/score error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { scoring };
