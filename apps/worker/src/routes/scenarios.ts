import {
	CreateScenarioSchema,
	CreateScenarioStepSchema,
	UpdateScenarioSchema,
	UpdateScenarioStepSchema,
	UuidSchema,
} from "@line-crm/contracts";
import { createFriendRepository, createScenarioRepository } from "@line-crm/db";
import type { FriendId, LineAccountId, ScenarioId, ScenarioStepId, TagId } from "@line-crm/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";

const scenarios = new Hono<Env>();

// GET /api/scenarios - list all
scenarios.get("/api/scenarios", async (c) => {
	try {
		const db = c.get("db");
		const scenarioRepo = createScenarioRepository(db);
		const lineAccountId = c.req.query("lineAccountId");
		const items = await scenarioRepo.list(lineAccountId as LineAccountId | undefined);
		return c.json({
			success: true,
			data: items.map((row) => ({
				id: row.id,
				name: row.name,
				description: row.description,
				triggerType: row.triggerType,
				triggerTagId: row.triggerTagId,
				isActive: row.isActive,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				stepCount: row.steps.length,
			})),
		});
	} catch (err) {
		console.error("GET /api/scenarios error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/scenarios/:id - get with steps
scenarios.get("/api/scenarios/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const scenarioRepo = createScenarioRepository(db);
		const scenario = await scenarioRepo.findById(id as ScenarioId);

		if (!scenario) {
			return c.json({ success: false, error: "Scenario not found" }, 404);
		}

		return c.json({ success: true, data: scenario });
	} catch (err) {
		console.error("GET /api/scenarios/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/scenarios - create
scenarios.post("/api/scenarios", validateJson(CreateScenarioSchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const db = c.get("db");
		const scenarioRepo = createScenarioRepository(db);

		const id = await scenarioRepo.create({
			name: body.name,
			description: body.description ?? undefined,
			triggerType: body.triggerType,
			triggerTagId: (body.triggerTagId ?? undefined) as TagId | undefined,
			lineAccountId: body.lineAccountId as LineAccountId | undefined,
		});

		// Override active state if the caller requested inactive
		if (body.isActive === false) {
			await scenarioRepo.setActive(id as ScenarioId, false);
		}

		const scenario = await scenarioRepo.findById(id as ScenarioId);
		return c.json({ success: true, data: scenario }, 201);
	} catch (err) {
		console.error("POST /api/scenarios error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/scenarios/:id - update (accepts camelCase fields from clients)
scenarios.put(
	"/api/scenarios/:id",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(UpdateScenarioSchema),
	async (c) => {
		try {
			const { id } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const scenarioRepo = createScenarioRepository(db);

			await scenarioRepo.update(id as ScenarioId, {
				name: body.name,
				description: body.description,
				triggerType: body.triggerType,
				triggerTagId: body.triggerTagId,
			});

			if (body.isActive !== undefined) {
				await scenarioRepo.setActive(id as ScenarioId, body.isActive);
			}

			const updated = await scenarioRepo.findById(id as ScenarioId);
			if (!updated) {
				return c.json({ success: false, error: "Scenario not found" }, 404);
			}

			return c.json({ success: true, data: updated });
		} catch (err) {
			console.error("PUT /api/scenarios/:id error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// DELETE /api/scenarios/:id - delete
scenarios.delete("/api/scenarios/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const scenarioRepo = createScenarioRepository(db);
		await scenarioRepo.delete(id as ScenarioId);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/scenarios/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/scenarios/:id/steps - add step
scenarios.post(
	"/api/scenarios/:id/steps",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(CreateScenarioStepSchema),
	async (c) => {
		try {
			const { id: scenarioId } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const scenarioRepo = createScenarioRepository(db);

			const stepId = await scenarioRepo.addStep(scenarioId as ScenarioId, {
				stepOrder: body.stepOrder,
				delayMinutes: body.delayMinutes ?? 0,
				messageType: body.messageType,
				messageContent: body.messageContent,
				conditionType: body.conditionType ?? undefined,
				conditionValue: body.conditionValue ?? undefined,
				nextStepOnFalse: body.nextStepOnFalse ?? undefined,
			});

			return c.json({ success: true, data: { id: stepId } }, 201);
		} catch (err) {
			console.error("POST /api/scenarios/:id/steps error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// PUT /api/scenarios/:id/steps/:stepId - update step (accepts camelCase)
scenarios.put(
	"/api/scenarios/:id/steps/:stepId",
	validateParam(z.object({ id: UuidSchema, stepId: UuidSchema })),
	validateJson(UpdateScenarioStepSchema),
	async (c) => {
		try {
			const { stepId } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const scenarioRepo = createScenarioRepository(db);

			await scenarioRepo.updateStep(stepId as ScenarioStepId, {
				stepOrder: body.stepOrder,
				delayMinutes: body.delayMinutes,
				messageType: body.messageType,
				messageContent: body.messageContent,
				conditionType: body.conditionType,
				conditionValue: body.conditionValue,
				nextStepOnFalse: body.nextStepOnFalse,
			});

			return c.json({ success: true, data: { id: stepId } });
		} catch (err) {
			console.error("PUT /api/scenarios/:id/steps/:stepId error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// DELETE /api/scenarios/:id/steps/:stepId - delete step
scenarios.delete(
	"/api/scenarios/:id/steps/:stepId",
	validateParam(z.object({ id: UuidSchema, stepId: UuidSchema })),
	async (c) => {
		try {
			const { stepId } = c.req.valid("param");
			const db = c.get("db");
			const scenarioRepo = createScenarioRepository(db);
			await scenarioRepo.removeStep(stepId as ScenarioStepId);
			return c.json({ success: true, data: null });
		} catch (err) {
			console.error("DELETE /api/scenarios/:id/steps/:stepId error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// POST /api/scenarios/:id/enroll/:friendId - manually enroll friend
scenarios.post(
	"/api/scenarios/:id/enroll/:friendId",
	validateParam(z.object({ id: UuidSchema, friendId: UuidSchema })),
	async (c) => {
		try {
			const { id: scenarioId, friendId } = c.req.valid("param");
			const db = c.get("db");
			const scenarioRepo = createScenarioRepository(db);
			const friendRepo = createFriendRepository(db);

			// Verify both exist
			const [scenario, friend] = await Promise.all([
				scenarioRepo.findById(scenarioId as ScenarioId),
				friendRepo.findById(friendId as FriendId),
			]);

			if (!scenario) {
				return c.json({ success: false, error: "Scenario not found" }, 404);
			}
			if (!friend) {
				return c.json({ success: false, error: "Friend not found" }, 404);
			}

			const enrollmentId = await scenarioRepo.enrollFriend(friendId as FriendId, scenarioId as ScenarioId, null);
			return c.json({ success: true, data: { id: enrollmentId } }, 201);
		} catch (err) {
			console.error("POST /api/scenarios/:id/enroll/:friendId error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { scenarios };
