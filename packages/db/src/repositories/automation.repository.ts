// =============================================================================
// Automation Repository - Drizzle ORM
// =============================================================================

import type { AutomationId, FriendId } from "@line-crm/domain";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { automationLogs, automations } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createAutomationRepository(db: Database) {
	const automationColumns = {
		id: automations.id,
		name: automations.name,
		description: automations.description,
		eventType: automations.eventType,
		conditions: automations.conditions,
		actions: automations.actions,
		isActive: automations.isActive,
		priority: automations.priority,
		lineAccountId: automations.lineAccountId,
		createdAt: automations.createdAt,
		updatedAt: automations.updatedAt,
	} as const;

	const logColumns = {
		id: automationLogs.id,
		automationId: automationLogs.automationId,
		friendId: automationLogs.friendId,
		eventData: automationLogs.eventData,
		actionsResult: automationLogs.actionsResult,
		status: automationLogs.status,
		createdAt: automationLogs.createdAt,
	} as const;

	return {
		/** List all automations ordered by priority then creation date */
		async list() {
			return db
				.select(automationColumns)
				.from(automations)
				.orderBy(desc(automations.priority), desc(automations.createdAt));
		},

		/** Find a single automation by ID */
		async findById(id: AutomationId) {
			const [row] = await db.select(automationColumns).from(automations).where(eq(automations.id, id));
			return row ?? null;
		},

		/** Create a new automation, returns the generated ID */
		async create(data: {
			name: string;
			description?: string;
			eventType: string;
			conditions?: string;
			actions?: string;
			priority?: number;
			lineAccountId?: string;
		}): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(automations).values({
				id,
				name: data.name,
				description: data.description ?? null,
				eventType: data.eventType,
				conditions: data.conditions ?? "{}",
				actions: data.actions ?? "[]",
				priority: data.priority ?? 0,
				lineAccountId: data.lineAccountId ?? null,
			});
			return id;
		},

		/** Partial update of automation fields */
		async update(
			id: AutomationId,
			updates: Partial<{
				name: string;
				description: string;
				eventType: string;
				conditions: string;
				actions: string;
				isActive: boolean;
				priority: number;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.description !== undefined) setClause.description = updates.description;
			if (updates.eventType !== undefined) setClause.eventType = updates.eventType;
			if (updates.conditions !== undefined) setClause.conditions = updates.conditions;
			if (updates.actions !== undefined) setClause.actions = updates.actions;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;
			if (updates.priority !== undefined) setClause.priority = updates.priority;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(automations).set(setClause).where(eq(automations.id, id));
		},

		/** Hard-delete an automation (automations table has no soft delete) */
		async delete(id: AutomationId): Promise<void> {
			await db.delete(automations).where(eq(automations.id, id));
		},

		/** Find active automations matching an event type, ordered by priority */
		async findActiveByEvent(eventType: string) {
			return db
				.select(automationColumns)
				.from(automations)
				.where(and(eq(automations.eventType, eventType), eq(automations.isActive, true)))
				.orderBy(desc(automations.priority));
		},

		/** Log an automation execution */
		async logExecution(data: {
			automationId: AutomationId;
			friendId?: FriendId;
			eventData?: string;
			actionsResult?: string;
			status: string;
		}): Promise<void> {
			const id = crypto.randomUUID();
			await db.insert(automationLogs).values({
				id,
				automationId: data.automationId,
				friendId: data.friendId ?? null,
				eventData: data.eventData ?? null,
				actionsResult: data.actionsResult ?? null,
				status: data.status,
			});
		},

		/** Get execution logs, optionally filtered by automation ID */
		async getLogs(automationId?: AutomationId, limit = 100) {
			const conditions = automationId ? [eq(automationLogs.automationId, automationId)] : [];

			return db
				.select(logColumns)
				.from(automationLogs)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(automationLogs.createdAt))
				.limit(limit);
		},
	};
}
