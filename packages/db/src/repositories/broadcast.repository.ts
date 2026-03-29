// =============================================================================
// Broadcast Repository - Drizzle ORM
// =============================================================================

import type { BroadcastId, LineAccountId } from "@line-crm/domain";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { broadcasts } from "../schema/index.js";
import { DateTime } from "../utils.js";

/** Status counts to update when transitioning broadcast status */
export interface BroadcastStatusCounts {
	totalCount?: number;
	successCount?: number;
}

export function createBroadcastRepository(db: Database) {
	const alive = isNull(broadcasts.deletedAt);

	const columns = {
		id: broadcasts.id,
		title: broadcasts.title,
		messageType: broadcasts.messageType,
		messageContent: broadcasts.messageContent,
		targetType: broadcasts.targetType,
		targetTagId: broadcasts.targetTagId,
		status: broadcasts.status,
		scheduledAt: broadcasts.scheduledAt,
		sentAt: broadcasts.sentAt,
		totalCount: broadcasts.totalCount,
		successCount: broadcasts.successCount,
		lineAccountId: broadcasts.lineAccountId,
		createdAt: broadcasts.createdAt,
	} as const;

	return {
		/** List all non-deleted broadcasts, newest first */
		async list(lineAccountId?: LineAccountId) {
			const conditions = [alive];
			if (lineAccountId) conditions.push(eq(broadcasts.lineAccountId, lineAccountId));

			return db
				.select(columns)
				.from(broadcasts)
				.where(and(...conditions))
				.orderBy(desc(broadcasts.createdAt));
		},

		/** Find a single broadcast by ID (soft-delete aware) */
		async findById(id: BroadcastId) {
			const [row] = await db
				.select(columns)
				.from(broadcasts)
				.where(and(eq(broadcasts.id, id), alive));
			return row ?? null;
		},

		/** Create a new broadcast, returns the generated ID */
		async create(data: {
			title: string;
			messageType: string;
			messageContent: string;
			targetType?: string;
			targetTagId?: string | null;
			scheduledAt?: string | null;
			lineAccountId?: LineAccountId;
		}): Promise<string> {
			const id = crypto.randomUUID();
			const initialStatus = data.scheduledAt ? "scheduled" : "draft";

			await db.insert(broadcasts).values({
				id,
				title: data.title,
				messageType: data.messageType,
				messageContent: data.messageContent,
				targetType: data.targetType ?? "all",
				targetTagId: data.targetTagId ?? null,
				status: initialStatus,
				scheduledAt: data.scheduledAt ?? null,
				lineAccountId: data.lineAccountId ?? null,
			});
			return id;
		},

		/** Partial update of broadcast fields (draft/scheduled only typically) */
		async update(
			id: BroadcastId,
			updates: Partial<{
				title: string;
				messageType: string;
				messageContent: string;
				targetType: string;
				targetTagId: string | null;
				status: string;
				scheduledAt: string | null;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.title !== undefined) setClause.title = updates.title;
			if (updates.messageType !== undefined) setClause.messageType = updates.messageType;
			if (updates.messageContent !== undefined) setClause.messageContent = updates.messageContent;
			if (updates.targetType !== undefined) setClause.targetType = updates.targetType;
			if (updates.targetTagId !== undefined) setClause.targetTagId = updates.targetTagId;
			if (updates.status !== undefined) setClause.status = updates.status;
			if (updates.scheduledAt !== undefined) setClause.scheduledAt = updates.scheduledAt;

			if (Object.keys(setClause).length === 0) return;

			await db
				.update(broadcasts)
				.set(setClause)
				.where(and(eq(broadcasts.id, id), alive));
		},

		/** Transition broadcast status with optional delivery counts */
		async updateStatus(id: BroadcastId, status: string, counts?: BroadcastStatusCounts): Promise<void> {
			const setClause: Record<string, unknown> = { status };

			if (status === "sent") {
				setClause.sentAt = DateTime.now().toISO();
			}
			if (counts?.totalCount !== undefined) setClause.totalCount = counts.totalCount;
			if (counts?.successCount !== undefined) setClause.successCount = counts.successCount;

			await db
				.update(broadcasts)
				.set(setClause)
				.where(and(eq(broadcasts.id, id), alive));
		},

		/** Soft-delete a broadcast */
		async softDelete(id: BroadcastId): Promise<void> {
			await db
				.update(broadcasts)
				.set({ deletedAt: DateTime.now().toISO() })
				.where(and(eq(broadcasts.id, id), alive));
		},

		/** Get broadcasts that are scheduled and due for sending */
		async getScheduledBroadcasts(beforeOrAt: string) {
			return db
				.select(columns)
				.from(broadcasts)
				.where(and(alive, eq(broadcasts.status, "scheduled"), sql`${broadcasts.scheduledAt} <= ${beforeOrAt}`))
				.orderBy(broadcasts.scheduledAt);
		},
	};
}
