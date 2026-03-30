// =============================================================================
// Entry Route Repository - Drizzle ORM
// =============================================================================

import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { entryRoutes, refTracking } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createEntryRouteRepository(db: Database) {
	return {
		async list() {
			return db.select().from(entryRoutes).orderBy(desc(entryRoutes.createdAt));
		},

		async findByRefCode(refCode: string) {
			const [row] = await db
				.select()
				.from(entryRoutes)
				.where(and(eq(entryRoutes.refCode, refCode), eq(entryRoutes.isActive, true)));
			return row ?? null;
		},

		async create(input: {
			refCode: string;
			name: string;
			tagId?: string | null;
			scenarioId?: string | null;
			redirectUrl?: string | null;
			isActive?: boolean;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(entryRoutes).values({
				id,
				refCode: input.refCode,
				name: input.name,
				tagId: input.tagId ?? null,
				scenarioId: input.scenarioId ?? null,
				redirectUrl: input.redirectUrl ?? null,
				isActive: input.isActive !== false,
				createdAt: now,
				updatedAt: now,
			});
			const [created] = await db.select().from(entryRoutes).where(eq(entryRoutes.id, id));
			if (!created) throw new Error(`Failed to retrieve entry route after insert: ${id}`);
			return created;
		},

		async update(
			id: string,
			input: Partial<{
				refCode: string;
				name: string;
				tagId: string | null;
				scenarioId: string | null;
				redirectUrl: string | null;
				isActive: boolean;
			}>,
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (input.name !== undefined) set.name = input.name;
			if (input.refCode !== undefined) set.refCode = input.refCode;
			if (input.tagId !== undefined) set.tagId = input.tagId;
			if (input.scenarioId !== undefined) set.scenarioId = input.scenarioId;
			if (input.redirectUrl !== undefined) set.redirectUrl = input.redirectUrl;
			if (input.isActive !== undefined) set.isActive = input.isActive;

			await db.update(entryRoutes).set(set).where(eq(entryRoutes.id, id));
			const [updated] = await db.select().from(entryRoutes).where(eq(entryRoutes.id, id));
			return updated ?? null;
		},

		async delete(id: string) {
			await db.delete(entryRoutes).where(eq(entryRoutes.id, id));
		},

		async recordTracking(opts: {
			refCode: string;
			friendId?: string | null;
			entryRouteId?: string | null;
			sourceUrl?: string | null;
			fbclid?: string | null;
			gclid?: string | null;
			twclid?: string | null;
			ttclid?: string | null;
			yclid?: string | null;
			utmSource?: string | null;
			utmMedium?: string | null;
			utmCampaign?: string | null;
			userAgent?: string | null;
			ipAddress?: string | null;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(refTracking).values({
				id,
				refCode: opts.refCode,
				friendId: opts.friendId ?? null,
				entryRouteId: opts.entryRouteId ?? null,
				sourceUrl: opts.sourceUrl ?? null,
				fbclid: opts.fbclid ?? null,
				gclid: opts.gclid ?? null,
				twclid: opts.twclid ?? null,
				ttclid: opts.ttclid ?? null,
				yclid: opts.yclid ?? null,
				utmSource: opts.utmSource ?? null,
				utmMedium: opts.utmMedium ?? null,
				utmCampaign: opts.utmCampaign ?? null,
				userAgent: opts.userAgent ?? null,
				ipAddress: opts.ipAddress ?? null,
				createdAt: now,
			});
			const [created] = await db.select().from(refTracking).where(eq(refTracking.id, id));
			if (!created) throw new Error(`Failed to retrieve ref tracking after insert: ${id}`);
			return created;
		},

		/** Get tracking record with click IDs for a friend */
		async getTracking(friendId: string) {
			const [row] = await db
				.select()
				.from(refTracking)
				.where(
					and(
						eq(refTracking.friendId, friendId),
						or(
							isNotNull(refTracking.fbclid),
							isNotNull(refTracking.gclid),
							isNotNull(refTracking.twclid),
							isNotNull(refTracking.ttclid),
							isNotNull(refTracking.yclid),
						),
					),
				)
				.orderBy(desc(refTracking.createdAt))
				.limit(1);
			return row ?? null;
		},

		async getTrackingByFriend(friendId: string) {
			return db
				.select()
				.from(refTracking)
				.where(eq(refTracking.friendId, friendId))
				.orderBy(desc(refTracking.createdAt));
		},

		async getStats(refCode: string) {
			const [row] = await db
				.select({
					refCode: refTracking.refCode,
					count: sql<number>`count(*)`,
				})
				.from(refTracking)
				.where(eq(refTracking.refCode, refCode))
				.groupBy(refTracking.refCode);
			return row ?? { refCode, count: 0 };
		},
	};
}
