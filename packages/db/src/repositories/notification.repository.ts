// =============================================================================
// Notification Repository - Drizzle ORM
// =============================================================================

import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { notificationRules, notifications } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createNotificationRepository(db: Database) {
	return {
		// --- Notification Rules ---

		async listRules() {
			return db.select().from(notificationRules).orderBy(desc(notificationRules.createdAt));
		},

		async findRuleById(id: string) {
			const [row] = await db.select().from(notificationRules).where(eq(notificationRules.id, id));
			return row ?? null;
		},

		async createRule(input: {
			name: string;
			eventType: string;
			conditions?: Record<string, unknown>;
			channels?: string[];
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(notificationRules).values({
				id,
				name: input.name,
				eventType: input.eventType,
				conditions: JSON.stringify(input.conditions ?? {}),
				channels: JSON.stringify(input.channels ?? ["dashboard"]),
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findRuleById(id);
			if (!created) throw new Error(`Failed to retrieve notification rule after insert: ${id}`);
			return created;
		},

		async updateRule(
			id: string,
			updates: Partial<{
				name: string;
				eventType: string;
				conditions: Record<string, unknown>;
				channels: string[];
				isActive: boolean;
			}>,
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (updates.name !== undefined) set.name = updates.name;
			if (updates.eventType !== undefined) set.eventType = updates.eventType;
			if (updates.conditions !== undefined) set.conditions = JSON.stringify(updates.conditions);
			if (updates.channels !== undefined) set.channels = JSON.stringify(updates.channels);
			if (updates.isActive !== undefined) set.isActive = updates.isActive;

			await db.update(notificationRules).set(set).where(eq(notificationRules.id, id));
		},

		async deleteRule(id: string) {
			await db.delete(notificationRules).where(eq(notificationRules.id, id));
		},

		// --- Notifications ---

		async listNotifications(opts: { status?: string; limit?: number } = {}) {
			const limit = opts.limit ?? 100;
			const conditions = [];
			if (opts.status) {
				conditions.push(eq(notifications.status, opts.status));
			}
			const where = conditions.length > 0 ? and(...conditions) : undefined;
			return db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit);
		},

		async createNotification(input: {
			ruleId?: string;
			eventType: string;
			title: string;
			body: string;
			channel: string;
			metadata?: string;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(notifications).values({
				id,
				ruleId: input.ruleId ?? null,
				eventType: input.eventType,
				title: input.title,
				body: input.body,
				channel: input.channel,
				metadata: input.metadata ?? null,
				createdAt: now,
			});
			const [created] = await db.select().from(notifications).where(eq(notifications.id, id));
			if (!created) throw new Error(`Failed to retrieve notification after insert: ${id}`);
			return created;
		},

		async updateStatus(id: string, status: string) {
			await db.update(notifications).set({ status }).where(eq(notifications.id, id));
		},

		async findActiveRulesByEvent(eventType: string) {
			return db
				.select()
				.from(notificationRules)
				.where(and(eq(notificationRules.eventType, eventType), eq(notificationRules.isActive, true)));
		},
	};
}
