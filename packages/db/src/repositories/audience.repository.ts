// =============================================================================
// Audience Repository — LINE Audience management with expiry tracking
// =============================================================================
// Manages audience lifecycle: create → use → expire → rotate → delete.
// Supports click, upload, impression, and IFA audience types.
// Handles 180-day LINE audience expiry with automatic rotation.

import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { audienceMembers, audienceRotationLogs, audiences } from "../schema/audiences.js";
import { DateTime } from "../utils.js";

// --- Types ---

export interface CreateAudienceInput {
	readonly name: string;
	readonly description?: string;
	readonly audienceType: "click" | "upload" | "impression" | "ifa";
	readonly lineAccountId: string;
	readonly lineAudienceId?: string;
	readonly tagId?: string;
	readonly clickSourceRequestId?: string;
	readonly impressionSourceRequestId?: string;
}

interface _AudienceWithMembers {
	readonly id: string;
	readonly name: string;
	readonly audienceType: string;
	readonly lineAudienceId: string | null;
	readonly userCount: number;
	readonly isActive: boolean;
	readonly expiresAt: string | null;
	readonly tagId: string | null;
	readonly memberCount: number;
}

// --- Repository Factory ---

export function createAudienceRepository(db: Database) {
	return {
		/**
		 * List audiences for a LINE account.
		 */
		async list(
			lineAccountId: string,
			opts?: {
				audienceType?: string;
				isActive?: boolean;
				limit?: number;
				offset?: number;
			},
		) {
			const conditions = [eq(audiences.lineAccountId, lineAccountId), isNull(audiences.deletedAt)];
			if (opts?.audienceType) {
				conditions.push(eq(audiences.audienceType, opts.audienceType));
			}
			if (opts?.isActive !== undefined) {
				conditions.push(eq(audiences.isActive, opts.isActive));
			}

			return db
				.select()
				.from(audiences)
				.where(and(...conditions))
				.orderBy(desc(audiences.createdAt))
				.limit(opts?.limit ?? 50)
				.offset(opts?.offset ?? 0);
		},

		/**
		 * Find audience by ID.
		 */
		async findById(id: string) {
			const [row] = await db
				.select()
				.from(audiences)
				.where(and(eq(audiences.id, id), isNull(audiences.deletedAt)));
			return row ?? null;
		},

		/**
		 * Find audience by LINE audience ID.
		 */
		async findByLineAudienceId(lineAudienceId: string) {
			const [row] = await db
				.select()
				.from(audiences)
				.where(and(eq(audiences.lineAudienceId, lineAudienceId), isNull(audiences.deletedAt)));
			return row ?? null;
		},

		/**
		 * Create a new audience record.
		 */
		async create(input: CreateAudienceInput) {
			const now = DateTime.now().toISO();
			// LINE audiences expire 180 days after creation
			const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

			const [row] = await db
				.insert(audiences)
				.values({
					name: input.name,
					description: input.description ?? null,
					audienceType: input.audienceType,
					lineAccountId: input.lineAccountId,
					lineAudienceId: input.lineAudienceId ?? null,
					tagId: input.tagId ?? null,
					clickSourceRequestId: input.clickSourceRequestId ?? null,
					impressionSourceRequestId: input.impressionSourceRequestId ?? null,
					lineCreatedAt: now,
					expiresAt,
				})
				.returning();
			return row;
		},

		/**
		 * Update LINE audience ID after API creation.
		 */
		async setLineAudienceId(id: string, lineAudienceId: string) {
			await db.update(audiences).set({ lineAudienceId, updatedAt: DateTime.now().toISO() }).where(eq(audiences.id, id));
		},

		/**
		 * Add members to an upload audience (batch).
		 */
		async addMembers(audienceId: string, identifiers: string[], identifierType = "line_user_id") {
			if (identifiers.length === 0) return;

			await db.insert(audienceMembers).values(
				identifiers.map((identifier) => ({
					audienceId,
					identifier,
					identifierType,
				})),
			);

			// Update user count
			await db
				.update(audiences)
				.set({
					userCount: sql`${audiences.userCount} + ${identifiers.length}`,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(audiences.id, audienceId));
		},

		/**
		 * Get members of an audience (for upload to LINE API).
		 */
		async getMembers(audienceId: string, limit = 5000) {
			return db
				.select({ identifier: audienceMembers.identifier })
				.from(audienceMembers)
				.where(eq(audienceMembers.audienceId, audienceId))
				.limit(limit);
		},

		/**
		 * Find audiences expiring within N days (for rotation batch).
		 */
		async findExpiring(withinDays: number) {
			const threshold = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();

			return db
				.select()
				.from(audiences)
				.where(
					and(
						isNull(audiences.deletedAt),
						eq(audiences.isActive, true),
						lt(audiences.expiresAt, threshold),
						isNull(audiences.rotatedToId),
					),
				);
		},

		/**
		 * Mark an audience as rotated (replaced by a new one).
		 */
		async markRotated(originalId: string, newId: string) {
			await db
				.update(audiences)
				.set({
					isActive: false,
					rotatedToId: newId,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(audiences.id, originalId));

			await db.insert(audienceRotationLogs).values({
				originalAudienceId: originalId,
				newAudienceId: newId,
				status: "completed",
			});
		},

		/**
		 * Soft delete an audience.
		 */
		async softDelete(id: string) {
			await db
				.update(audiences)
				.set({
					deletedAt: DateTime.now().toISO(),
					isActive: false,
				})
				.where(eq(audiences.id, id));
		},

		/**
		 * Find audience linked to a specific CRM tag.
		 */
		async findByTagId(tagId: string) {
			const [row] = await db
				.select()
				.from(audiences)
				.where(and(eq(audiences.tagId, tagId), isNull(audiences.deletedAt), eq(audiences.isActive, true)));
			return row ?? null;
		},
	};
}
