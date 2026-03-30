// =============================================================================
// Affiliate Repository - Drizzle ORM
// =============================================================================

import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { affiliateClicks, affiliates } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createAffiliateRepository(db: Database) {
	return {
		async list() {
			return db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
		},

		async findById(id: string) {
			const [row] = await db.select().from(affiliates).where(eq(affiliates.id, id));
			return row ?? null;
		},

		async findByCode(code: string) {
			const [row] = await db.select().from(affiliates).where(eq(affiliates.code, code));
			return row ?? null;
		},

		async create(input: { name: string; code: string; commissionRate?: number }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(affiliates).values({
				id,
				name: input.name,
				code: input.code,
				commissionRate: input.commissionRate ?? 0,
				isActive: true,
				createdAt: now,
			});
			const created = await this.findById(id);
			if (!created) throw new Error(`Failed to retrieve affiliate after insert: ${id}`);
			return created;
		},

		async update(id: string, updates: Partial<{ name: string; commissionRate: number; isActive: boolean }>) {
			const set: Record<string, unknown> = {};
			if (updates.name !== undefined) set.name = updates.name;
			if (updates.commissionRate !== undefined) set.commissionRate = updates.commissionRate;
			if (updates.isActive !== undefined) set.isActive = updates.isActive;
			if (Object.keys(set).length === 0) return this.findById(id);

			await db.update(affiliates).set(set).where(eq(affiliates.id, id));
			return this.findById(id);
		},

		async delete(id: string) {
			await db.delete(affiliates).where(eq(affiliates.id, id));
		},

		async recordClick(affiliateId: string, url?: string | null, ipAddress?: string | null) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(affiliateClicks).values({
				id,
				affiliateId,
				url: url ?? null,
				ipAddress: ipAddress ?? null,
				createdAt: now,
			});
			const [created] = await db.select().from(affiliateClicks).where(eq(affiliateClicks.id, id));
			if (!created) throw new Error(`Failed to retrieve affiliate click after insert: ${id}`);
			return created;
		},

		async getReport(affiliateId?: string) {
			const rows = await db
				.select({
					affiliateId: affiliates.id,
					affiliateName: affiliates.name,
					code: affiliates.code,
					commissionRate: affiliates.commissionRate,
					totalClicks: sql<number>`(SELECT count(*) FROM affiliate_clicks ac WHERE ac.affiliate_id = ${affiliates.id})`,
					totalConversions: sql<number>`(SELECT count(*) FROM conversion_events ce WHERE ce.affiliate_code = ${affiliates.code})`,
					totalRevenue: sql<number>`(SELECT coalesce(sum(cp.value), 0) FROM conversion_events ce JOIN conversion_points cp ON cp.id = ce.conversion_point_id WHERE ce.affiliate_code = ${affiliates.code})`,
				})
				.from(affiliates)
				.where(affiliateId ? eq(affiliates.id, affiliateId) : undefined)
				.orderBy(sql`totalConversions DESC`);

			return rows;
		},
	};
}
