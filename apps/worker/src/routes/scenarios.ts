import {
	CreateScenarioSchema,
	CreateScenarioStepSchema,
	UpdateScenarioSchema,
	UpdateScenarioStepSchema,
	UuidSchema,
} from "@line-crm/contracts";
import type {
	FriendScenario as DbFriendScenario,
	Scenario as DbScenario,
	ScenarioStep as DbScenarioStep,
} from "@line-crm/db";
import {
	createScenario,
	createScenarioRepository,
	createScenarioStep,
	deleteScenario,
	deleteScenarioStep,
	enrollFriendInScenario,
	getFriendById,
	getScenarioById,
	updateScenario,
	updateScenarioStep,
} from "@line-crm/db";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";

const scenarios = new Hono<Env>();

/** Convert D1 snake_case Scenario row to shared camelCase shape */
function serializeScenario(row: DbScenario) {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		triggerType: row.trigger_type,
		triggerTagId: row.trigger_tag_id,
		isActive: Boolean(row.is_active),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** Convert D1 snake_case ScenarioStep row to shared camelCase shape */
function serializeStep(row: DbScenarioStep) {
	return {
		id: row.id,
		scenarioId: row.scenario_id,
		stepOrder: row.step_order,
		delayMinutes: row.delay_minutes,
		messageType: row.message_type,
		messageContent: row.message_content,
		conditionType: row.condition_type ?? null,
		conditionValue: row.condition_value ?? null,
		nextStepOnFalse: row.next_step_on_false ?? null,
		createdAt: row.created_at,
	};
}

/** Convert D1 snake_case FriendScenario row to shared camelCase shape */
function serializeFriendScenario(row: DbFriendScenario) {
	return {
		id: row.id,
		friendId: row.friend_id,
		scenarioId: row.scenario_id,
		currentStepOrder: row.current_step_order,
		status: row.status,
		startedAt: row.started_at,
		nextDeliveryAt: row.next_delivery_at,
		updatedAt: row.updated_at,
	};
}

// GET /api/scenarios - list all
scenarios.get("/api/scenarios", async (c) => {
	try {
		const db = c.get("db");
		const scenarioRepo = createScenarioRepository(db);
		const lineAccountId = c.req.query("lineAccountId");
		const items = await scenarioRepo.list(lineAccountId);
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
		const scenario = await getScenarioById(c.env.DB, id);

		if (!scenario) {
			return c.json({ success: false, error: "Scenario not found" }, 404);
		}

		return c.json({
			success: true,
			data: {
				...serializeScenario(scenario),
				steps: scenario.steps.map(serializeStep),
			},
		});
	} catch (err) {
		console.error("GET /api/scenarios/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/scenarios - create
scenarios.post("/api/scenarios", validateJson(CreateScenarioSchema), async (c) => {
	try {
		const body = c.req.valid("json");

		let scenario = await createScenario(c.env.DB, {
			name: body.name,
			description: body.description ?? null,
			triggerType: body.triggerType,
			triggerTagId: body.triggerTagId ?? null,
		});

		// TODO: Migrate to Drizzle repository once createScenarioRepository supports lineAccountId update
		// Save line_account_id if provided
		if (body.lineAccountId) {
			await c.env.DB.prepare("UPDATE scenarios SET line_account_id = ? WHERE id = ?")
				.bind(body.lineAccountId, scenario.id)
				.run();
		}

		// createScenario() always sets is_active=1; override if the caller requested inactive
		if (body.isActive === false) {
			const updated = await updateScenario(c.env.DB, scenario.id, { is_active: 0 });
			if (updated) scenario = updated;
		}

		return c.json({ success: true, data: serializeScenario(scenario) }, 201);
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

			const updated = await updateScenario(c.env.DB, id, {
				name: body.name,
				description: body.description,
				trigger_type: body.triggerType,
				trigger_tag_id: body.triggerTagId,
				is_active: body.isActive !== undefined ? (body.isActive ? 1 : 0) : undefined,
			});

			if (!updated) {
				return c.json({ success: false, error: "Scenario not found" }, 404);
			}

			return c.json({ success: true, data: serializeScenario(updated) });
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
		await deleteScenario(c.env.DB, id);
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

			const step = await createScenarioStep(c.env.DB, {
				scenarioId,
				stepOrder: body.stepOrder,
				delayMinutes: body.delayMinutes ?? 0,
				messageType: body.messageType,
				messageContent: body.messageContent,
				conditionType: body.conditionType ?? null,
				conditionValue: body.conditionValue ?? null,
				nextStepOnFalse: body.nextStepOnFalse ?? null,
			});

			return c.json({ success: true, data: serializeStep(step) }, 201);
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

			const updated = await updateScenarioStep(c.env.DB, stepId, {
				step_order: body.stepOrder,
				delay_minutes: body.delayMinutes,
				message_type: body.messageType,
				message_content: body.messageContent,
				condition_type: body.conditionType,
				condition_value: body.conditionValue,
				next_step_on_false: body.nextStepOnFalse,
			});

			if (!updated) {
				return c.json({ success: false, error: "Step not found" }, 404);
			}

			return c.json({ success: true, data: serializeStep(updated) });
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
			await deleteScenarioStep(c.env.DB, stepId);
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
			const db = c.env.DB;

			// Verify both exist
			const [scenario, friend] = await Promise.all([getScenarioById(db, scenarioId), getFriendById(db, friendId)]);

			if (!scenario) {
				return c.json({ success: false, error: "Scenario not found" }, 404);
			}
			if (!friend) {
				return c.json({ success: false, error: "Friend not found" }, 404);
			}

			const enrollment = await enrollFriendInScenario(db, friendId, scenarioId);
			return c.json({ success: true, data: serializeFriendScenario(enrollment) }, 201);
		} catch (err) {
			console.error("POST /api/scenarios/:id/enroll/:friendId error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { scenarios };
