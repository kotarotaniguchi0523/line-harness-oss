import { AddScoreSchema, CreateScoringRuleSchema, UpdateScoringRuleSchema, UuidSchema } from "@line-crm/contracts";
import {
	addScore,
	createScoringRule,
	deleteScoringRule,
	getFriendScore,
	getFriendScoreHistory,
	getScoringRuleById,
	getScoringRules,
	updateScoringRule,
} from "@line-crm/db";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";

const scoring = new Hono<Env>();

// ========== スコアリングルールCRUD ==========

scoring.get("/api/scoring-rules", async (c) => {
	try {
		const items = await getScoringRules(c.env.DB);
		return c.json({
			success: true,
			data: items.map((r) => ({
				id: r.id,
				name: r.name,
				eventType: r.event_type,
				scoreValue: r.score_value,
				isActive: Boolean(r.is_active),
				createdAt: r.created_at,
				updatedAt: r.updated_at,
			})),
		});
	} catch (err) {
		console.error("GET /api/scoring-rules error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

scoring.get("/api/scoring-rules/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const item = await getScoringRuleById(c.env.DB, id);
		if (!item) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({
			success: true,
			data: {
				id: item.id,
				name: item.name,
				eventType: item.event_type,
				scoreValue: item.score_value,
				isActive: Boolean(item.is_active),
				createdAt: item.created_at,
			},
		});
	} catch (err) {
		console.error("GET /api/scoring-rules/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

scoring.post("/api/scoring-rules", validateJson(CreateScoringRuleSchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const item = await createScoringRule(c.env.DB, body);
		return c.json(
			{
				success: true,
				data: { id: item.id, name: item.name, eventType: item.event_type, scoreValue: item.score_value },
			},
			201,
		);
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
			await updateScoringRule(c.env.DB, id, body);
			const updated = await getScoringRuleById(c.env.DB, id);
			if (!updated) return c.json({ success: false, error: "Not found" }, 404);
			return c.json({
				success: true,
				data: {
					id: updated.id,
					name: updated.name,
					eventType: updated.event_type,
					scoreValue: updated.score_value,
					isActive: Boolean(updated.is_active),
				},
			});
		} catch (err) {
			console.error("PUT /api/scoring-rules/:id error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

scoring.delete("/api/scoring-rules/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		await deleteScoringRule(c.env.DB, id);
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
		const [score, history] = await Promise.all([
			getFriendScore(c.env.DB, friendId),
			getFriendScoreHistory(c.env.DB, friendId),
		]);
		return c.json({
			success: true,
			data: {
				friendId,
				currentScore: score,
				history: history.map((h) => ({
					id: h.id,
					scoringRuleId: h.scoring_rule_id,
					scoreChange: h.score_change,
					reason: h.reason,
					createdAt: h.created_at,
				})),
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
			await addScore(c.env.DB, { friendId, scoreChange: body.scoreChange, reason: body.reason });
			const newScore = await getFriendScore(c.env.DB, friendId);
			return c.json({ success: true, data: { friendId, currentScore: newScore } }, 201);
		} catch (err) {
			console.error("POST /api/friends/:id/score error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { scoring };
