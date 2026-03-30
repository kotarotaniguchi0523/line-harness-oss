// =============================================================================
// Scenario Repository - Drizzle ORM
// =============================================================================

import type { FriendId, LineAccountId, ScenarioId, ScenarioStepId, TagId } from "@line-crm/domain";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friendScenarios, scenarioSteps, scenarios } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createScenarioRepository(db: Database) {
	return {
		async list(lineAccountId?: LineAccountId) {
			const conditions = [isNull(scenarios.deletedAt)];
			if (lineAccountId) conditions.push(eq(scenarios.lineAccountId, lineAccountId));

			const rows = await db
				.select()
				.from(scenarios)
				.where(and(...conditions))
				.orderBy(desc(scenarios.createdAt));

			// Batch load steps for all scenarios
			if (rows.length === 0) return [];
			const ids = rows.map((s) => s.id);
			const steps = await db
				.select()
				.from(scenarioSteps)
				.where(
					sql`${scenarioSteps.scenarioId} IN (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.orderBy(scenarioSteps.stepOrder);

			const stepsByScenario = new Map<string, typeof steps>();
			for (const step of steps) {
				const arr = stepsByScenario.get(step.scenarioId) ?? [];
				arr.push(step);
				stepsByScenario.set(step.scenarioId, arr);
			}

			return rows.map((s) => ({
				...s,
				isActive: Boolean(s.isActive),
				steps: stepsByScenario.get(s.id) ?? [],
			}));
		},

		async findById(id: ScenarioId) {
			const [scenario] = await db
				.select()
				.from(scenarios)
				.where(and(eq(scenarios.id, id), isNull(scenarios.deletedAt)));
			if (!scenario) return null;

			const steps = await db
				.select()
				.from(scenarioSteps)
				.where(eq(scenarioSteps.scenarioId, id))
				.orderBy(scenarioSteps.stepOrder);

			return { ...scenario, isActive: Boolean(scenario.isActive), steps };
		},

		async create(data: {
			name: string;
			description?: string;
			triggerType: string;
			triggerTagId?: TagId;
			lineAccountId?: LineAccountId;
		}) {
			const id = crypto.randomUUID();
			await db.insert(scenarios).values({
				id,
				name: data.name,
				description: data.description ?? null,
				triggerType: data.triggerType,
				triggerTagId: data.triggerTagId ?? null,
				lineAccountId: data.lineAccountId ?? null,
			});
			return id;
		},

		async addStep(
			scenarioId: ScenarioId,
			data: {
				stepOrder: number;
				delayMinutes: number;
				messageType: string;
				messageContent: string;
				conditionType?: string;
				conditionValue?: string;
				nextStepOnFalse?: number;
			},
		) {
			const id = crypto.randomUUID();
			await db.insert(scenarioSteps).values({
				id,
				scenarioId,
				stepOrder: data.stepOrder,
				delayMinutes: data.delayMinutes,
				messageType: data.messageType,
				messageContent: data.messageContent,
				conditionType: data.conditionType ?? null,
				conditionValue: data.conditionValue ?? null,
				nextStepOnFalse: data.nextStepOnFalse ?? null,
			});
			return id;
		},

		async removeStep(stepId: ScenarioStepId) {
			await db.delete(scenarioSteps).where(eq(scenarioSteps.id, stepId));
		},

		async setActive(id: ScenarioId, isActive: boolean) {
			await db.update(scenarios).set({ isActive, updatedAt: DateTime.now().toISO() }).where(eq(scenarios.id, id));
		},

		async update(
			id: ScenarioId,
			updates: Partial<{
				name: string;
				description: string | null;
				triggerType: string;
				triggerTagId: string | null;
				lineAccountId: string | null;
			}>,
		) {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.description !== undefined) setClause.description = updates.description;
			if (updates.triggerType !== undefined) setClause.triggerType = updates.triggerType;
			if (updates.triggerTagId !== undefined) setClause.triggerTagId = updates.triggerTagId;
			if (updates.lineAccountId !== undefined) setClause.lineAccountId = updates.lineAccountId;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(scenarios).set(setClause).where(eq(scenarios.id, id));
		},

		async updateStep(
			stepId: ScenarioStepId,
			updates: Partial<{
				stepOrder: number;
				delayMinutes: number;
				messageType: string;
				messageContent: string;
				conditionType: string | null;
				conditionValue: string | null;
				nextStepOnFalse: number | null;
			}>,
		) {
			const setClause: Record<string, unknown> = {};
			if (updates.stepOrder !== undefined) setClause.stepOrder = updates.stepOrder;
			if (updates.delayMinutes !== undefined) setClause.delayMinutes = updates.delayMinutes;
			if (updates.messageType !== undefined) setClause.messageType = updates.messageType;
			if (updates.messageContent !== undefined) setClause.messageContent = updates.messageContent;
			if (updates.conditionType !== undefined) setClause.conditionType = updates.conditionType;
			if (updates.conditionValue !== undefined) setClause.conditionValue = updates.conditionValue;
			if (updates.nextStepOnFalse !== undefined) setClause.nextStepOnFalse = updates.nextStepOnFalse;

			if (Object.keys(setClause).length === 0) return;

			await db.update(scenarioSteps).set(setClause).where(eq(scenarioSteps.id, stepId));
		},

		async delete(id: ScenarioId) {
			await db.update(scenarios).set({ deletedAt: DateTime.now().toISO() }).where(eq(scenarios.id, id));
		},

		async listActive(lineAccountId?: LineAccountId) {
			const conditions = [isNull(scenarios.deletedAt), eq(scenarios.isActive, true)];
			if (lineAccountId) conditions.push(eq(scenarios.lineAccountId, lineAccountId));
			return db
				.select()
				.from(scenarios)
				.where(and(...conditions));
		},

		// Friend enrollment
		async enrollFriend(friendId: FriendId, scenarioId: ScenarioId, nextDeliveryAt: string | null) {
			const id = crypto.randomUUID();
			await db
				.insert(friendScenarios)
				.values({
					id,
					friendId,
					scenarioId,
					nextDeliveryAt,
				})
				.onConflictDoNothing();
			return id;
		},

		async advanceFriendScenario(id: string, currentStepOrder: number, nextDeliveryAt: string | null) {
			await db
				.update(friendScenarios)
				.set({
					currentStepOrder,
					nextDeliveryAt,
					status: "active",
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(friendScenarios.id, id));
		},

		async completeFriendScenario(id: string) {
			await db
				.update(friendScenarios)
				.set({
					status: "completed",
					nextDeliveryAt: null,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(friendScenarios.id, id));
		},

		async getDueDeliveries(limit = 500) {
			const now = DateTime.now().toISO();
			return db
				.select({
					id: friendScenarios.id,
					friendId: friendScenarios.friendId,
					scenarioId: friendScenarios.scenarioId,
					currentStepOrder: friendScenarios.currentStepOrder,
					status: friendScenarios.status,
					startedAt: friendScenarios.startedAt,
					nextDeliveryAt: friendScenarios.nextDeliveryAt,
					updatedAt: friendScenarios.updatedAt,
				})
				.from(friendScenarios)
				.innerJoin(scenarios, eq(friendScenarios.scenarioId, scenarios.id))
				.where(
					and(
						eq(friendScenarios.status, "active"),
						eq(scenarios.isActive, true),
						isNull(scenarios.deletedAt),
						sql`${friendScenarios.nextDeliveryAt} <= ${now}`,
					),
				)
				.limit(limit);
		},
	};
}
