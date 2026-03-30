// =============================================================================
// Conversion Repository - Drizzle ORM
// =============================================================================

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { conversionEvents, conversionPoints } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createConversionRepository(db: Database) {
	return {
		// --- Conversion Points ---

		async listPoints() {
			return db.select().from(conversionPoints).orderBy(desc(conversionPoints.createdAt));
		},

		async findPointById(id: string) {
			const [row] = await db.select().from(conversionPoints).where(eq(conversionPoints.id, id));
			return row ?? null;
		},

		async createPoint(input: { name: string; eventType: string; value?: number | null }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(conversionPoints).values({
				id,
				name: input.name,
				eventType: input.eventType,
				value: input.value ?? null,
				createdAt: now,
			});
			const created = await this.findPointById(id);
			if (!created) throw new Error(`Failed to retrieve conversion point after insert: ${id}`);
			return created;
		},

		async deletePoint(id: string) {
			await db.delete(conversionPoints).where(eq(conversionPoints.id, id));
		},

		// --- Conversion Events ---

		async track(input: {
			conversionPointId: string;
			friendId: string;
			userId?: string | null;
			affiliateCode?: string | null;
			metadata?: string | null;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(conversionEvents).values({
				id,
				conversionPointId: input.conversionPointId,
				friendId: input.friendId,
				userId: input.userId ?? null,
				affiliateCode: input.affiliateCode ?? null,
				metadata: input.metadata ?? null,
				createdAt: now,
			});
			const [created] = await db.select().from(conversionEvents).where(eq(conversionEvents.id, id));
			if (!created) throw new Error(`Failed to retrieve conversion event after insert: ${id}`);
			return created;
		},

		async getEvents(
			opts: {
				conversionPointId?: string;
				friendId?: string;
				affiliateCode?: string;
				startDate?: string;
				endDate?: string;
				limit?: number;
				offset?: number;
			} = {},
		) {
			const conditions = [];
			if (opts.conversionPointId) conditions.push(eq(conversionEvents.conversionPointId, opts.conversionPointId));
			if (opts.friendId) conditions.push(eq(conversionEvents.friendId, opts.friendId));
			if (opts.affiliateCode) conditions.push(eq(conversionEvents.affiliateCode, opts.affiliateCode));
			if (opts.startDate) conditions.push(gte(conversionEvents.createdAt, opts.startDate));
			if (opts.endDate) conditions.push(lte(conversionEvents.createdAt, opts.endDate));

			const where = conditions.length > 0 ? and(...conditions) : undefined;
			const limit = opts.limit ?? 100;
			const offset = opts.offset ?? 0;

			return db
				.select()
				.from(conversionEvents)
				.where(where)
				.orderBy(desc(conversionEvents.createdAt))
				.limit(limit)
				.offset(offset);
		},

		async getReport(opts: { startDate?: string; endDate?: string } = {}) {
			// Build date filter conditions for the LEFT JOIN
			const joinConditions = [eq(conversionEvents.conversionPointId, conversionPoints.id)];
			if (opts.startDate) joinConditions.push(gte(conversionEvents.createdAt, opts.startDate));
			if (opts.endDate) joinConditions.push(lte(conversionEvents.createdAt, opts.endDate));

			const rows = await db
				.select({
					conversionPointId: conversionPoints.id,
					conversionPointName: conversionPoints.name,
					eventType: conversionPoints.eventType,
					totalCount: sql<number>`count(${conversionEvents.id})`,
					totalValue: sql<number>`coalesce(sum(${conversionPoints.value}), 0)`,
				})
				.from(conversionPoints)
				.leftJoin(conversionEvents, and(...joinConditions))
				.groupBy(conversionPoints.id)
				.orderBy(sql`count(${conversionEvents.id}) DESC`);

			return rows;
		},
	};
}
