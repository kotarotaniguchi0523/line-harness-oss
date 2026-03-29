// =============================================================================
// Reminder Repository - Drizzle ORM
// =============================================================================

import type { FriendId, ReminderId } from "@line-crm/domain";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friendReminderDeliveries, friendReminders, reminderSteps, reminders } from "../schema/index.js";
import { DateTime } from "../utils.js";

/** A friend reminder with its due (undelivered) steps */
export interface DueDelivery {
	id: string;
	friendId: string;
	reminderId: string;
	targetDate: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	steps: Array<{
		id: string;
		reminderId: string;
		offsetMinutes: number;
		messageType: string;
		messageContent: string;
		createdAt: string;
	}>;
}

export function createReminderRepository(db: Database) {
	const reminderColumns = {
		id: reminders.id,
		name: reminders.name,
		description: reminders.description,
		isActive: reminders.isActive,
		createdAt: reminders.createdAt,
		updatedAt: reminders.updatedAt,
	} as const;

	const stepColumns = {
		id: reminderSteps.id,
		reminderId: reminderSteps.reminderId,
		offsetMinutes: reminderSteps.offsetMinutes,
		messageType: reminderSteps.messageType,
		messageContent: reminderSteps.messageContent,
		createdAt: reminderSteps.createdAt,
	} as const;

	const friendReminderColumns = {
		id: friendReminders.id,
		friendId: friendReminders.friendId,
		reminderId: friendReminders.reminderId,
		targetDate: friendReminders.targetDate,
		status: friendReminders.status,
		createdAt: friendReminders.createdAt,
		updatedAt: friendReminders.updatedAt,
	} as const;

	return {
		/** List all reminders, newest first */
		async list() {
			return db.select(reminderColumns).from(reminders).orderBy(desc(reminders.createdAt));
		},

		/** Find a reminder by ID with its steps */
		async findById(id: ReminderId) {
			const [row] = await db.select(reminderColumns).from(reminders).where(eq(reminders.id, id));
			if (!row) return null;

			const steps = await db
				.select(stepColumns)
				.from(reminderSteps)
				.where(eq(reminderSteps.reminderId, id))
				.orderBy(asc(reminderSteps.offsetMinutes));

			return { ...row, steps };
		},

		/** Create a new reminder, returns the generated ID */
		async create(data: { name: string; description?: string }): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(reminders).values({
				id,
				name: data.name,
				description: data.description ?? null,
			});
			return id;
		},

		/** Partial update of a reminder */
		async update(
			id: ReminderId,
			updates: Partial<{ name: string; description: string; isActive: boolean }>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.description !== undefined) setClause.description = updates.description;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(reminders).set(setClause).where(eq(reminders.id, id));
		},

		/** Hard-delete a reminder */
		async delete(id: ReminderId): Promise<void> {
			await db.delete(reminders).where(eq(reminders.id, id));
		},

		/** Add a step to a reminder, returns the generated step ID */
		async addStep(data: {
			reminderId: ReminderId;
			offsetMinutes: number;
			messageType: string;
			messageContent: string;
		}): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(reminderSteps).values({
				id,
				reminderId: data.reminderId,
				offsetMinutes: data.offsetMinutes,
				messageType: data.messageType,
				messageContent: data.messageContent,
			});
			return id;
		},

		/** Remove a step */
		async removeStep(stepId: string): Promise<void> {
			await db.delete(reminderSteps).where(eq(reminderSteps.id, stepId));
		},

		/** Enroll a friend in a reminder */
		async enrollFriend(data: { friendId: FriendId; reminderId: ReminderId; targetDate: string }): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(friendReminders).values({
				id,
				friendId: data.friendId,
				reminderId: data.reminderId,
				targetDate: data.targetDate,
			});
			return id;
		},

		/** Get all reminders enrolled for a friend */
		async getFriendReminders(friendId: FriendId) {
			return db
				.select(friendReminderColumns)
				.from(friendReminders)
				.where(eq(friendReminders.friendId, friendId))
				.orderBy(asc(friendReminders.targetDate));
		},

		/** Cancel a friend reminder */
		async cancelFriendReminder(id: string): Promise<void> {
			await db
				.update(friendReminders)
				.set({ status: "cancelled", updatedAt: DateTime.now().toISO() })
				.where(eq(friendReminders.id, id));
		},

		/**
		 * Get due deliveries: active friend_reminders with undelivered steps
		 * that are past their delivery time (target_date + offset_minutes).
		 * Uses a single JOIN query to avoid N+1.
		 */
		async getDueDeliveries(now: string): Promise<DueDelivery[]> {
			const rows = await db
				.select({
					frId: friendReminders.id,
					friendId: friendReminders.friendId,
					reminderId: friendReminders.reminderId,
					targetDate: friendReminders.targetDate,
					frStatus: friendReminders.status,
					frCreatedAt: friendReminders.createdAt,
					frUpdatedAt: friendReminders.updatedAt,
					rsId: reminderSteps.id,
					rsReminderId: reminderSteps.reminderId,
					offsetMinutes: reminderSteps.offsetMinutes,
					messageType: reminderSteps.messageType,
					messageContent: reminderSteps.messageContent,
					rsCreatedAt: reminderSteps.createdAt,
					deliveryId: friendReminderDeliveries.id,
				})
				.from(friendReminders)
				.innerJoin(reminders, eq(friendReminders.reminderId, reminders.id))
				.innerJoin(reminderSteps, eq(reminderSteps.reminderId, friendReminders.reminderId))
				.leftJoin(
					friendReminderDeliveries,
					and(
						eq(friendReminderDeliveries.friendReminderId, friendReminders.id),
						eq(friendReminderDeliveries.reminderStepId, reminderSteps.id),
					),
				)
				.where(
					and(eq(friendReminders.status, "active"), eq(reminders.isActive, true), isNull(friendReminderDeliveries.id)),
				);

			const nowMs = new Date(now).getTime();
			const grouped = new Map<string, DueDelivery>();

			for (const row of rows) {
				// Check if this step is due based on target_date + offset
				const targetTime = new Date(row.targetDate).getTime() + row.offsetMinutes * 60_000;
				if (targetTime > nowMs) continue;

				let entry = grouped.get(row.frId);
				if (!entry) {
					entry = {
						id: row.frId,
						friendId: row.friendId,
						reminderId: row.reminderId,
						targetDate: row.targetDate,
						status: row.frStatus,
						createdAt: row.frCreatedAt,
						updatedAt: row.frUpdatedAt,
						steps: [],
					};
					grouped.set(row.frId, entry);
				}

				entry.steps.push({
					id: row.rsId,
					reminderId: row.rsReminderId,
					offsetMinutes: row.offsetMinutes,
					messageType: row.messageType,
					messageContent: row.messageContent,
					createdAt: row.rsCreatedAt,
				});
			}

			return Array.from(grouped.values());
		},

		/** Record a step as delivered (idempotent via unique constraint) */
		async markDelivered(friendReminderId: string, reminderStepId: string): Promise<void> {
			await db
				.insert(friendReminderDeliveries)
				.values({
					id: crypto.randomUUID(),
					friendReminderId,
					reminderStepId,
				})
				.onConflictDoNothing();
		},

		/** Complete a friend reminder if all steps have been delivered */
		async completeIfDone(friendReminderId: string, reminderId: ReminderId): Promise<void> {
			const [totalResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(reminderSteps)
				.where(eq(reminderSteps.reminderId, reminderId));

			const [deliveredResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(friendReminderDeliveries)
				.where(eq(friendReminderDeliveries.friendReminderId, friendReminderId));

			const totalCount = totalResult?.count ?? 0;
			const deliveredCount = deliveredResult?.count ?? 0;

			if (totalCount > 0 && deliveredCount >= totalCount) {
				await db
					.update(friendReminders)
					.set({ status: "completed", updatedAt: DateTime.now().toISO() })
					.where(eq(friendReminders.id, friendReminderId));
			}
		},
	};
}
