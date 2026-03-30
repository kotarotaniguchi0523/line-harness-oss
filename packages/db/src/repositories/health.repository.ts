// =============================================================================
// Health Repository - Drizzle ORM (BAN detection & recovery)
// =============================================================================

import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { accountHealthLogs, accountMigrations } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createHealthRepository(db: Database) {
	return {
		// --- Health Logs ---

		async getLogs(lineAccountId: string, limit = 50) {
			return db
				.select()
				.from(accountHealthLogs)
				.where(eq(accountHealthLogs.lineAccountId, lineAccountId))
				.orderBy(desc(accountHealthLogs.createdAt))
				.limit(limit);
		},

		async createLog(input: {
			lineAccountId: string;
			errorCode?: number;
			errorCount: number;
			checkPeriod: string;
			riskLevel: string;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(accountHealthLogs).values({
				id,
				lineAccountId: input.lineAccountId,
				errorCode: input.errorCode ?? null,
				errorCount: input.errorCount,
				checkPeriod: input.checkPeriod,
				riskLevel: input.riskLevel,
				createdAt: now,
			});
			const [created] = await db.select().from(accountHealthLogs).where(eq(accountHealthLogs.id, id));
			if (!created) throw new Error(`Failed to retrieve health log after insert: ${id}`);
			return created;
		},

		async getLatestRiskLevel(lineAccountId: string): Promise<string> {
			const [row] = await db
				.select({ riskLevel: accountHealthLogs.riskLevel })
				.from(accountHealthLogs)
				.where(eq(accountHealthLogs.lineAccountId, lineAccountId))
				.orderBy(desc(accountHealthLogs.createdAt))
				.limit(1);
			return row?.riskLevel ?? "normal";
		},

		// --- Migrations ---

		async listMigrations() {
			return db.select().from(accountMigrations).orderBy(desc(accountMigrations.createdAt));
		},

		async findMigrationById(id: string) {
			const [row] = await db.select().from(accountMigrations).where(eq(accountMigrations.id, id));
			return row ?? null;
		},

		async createMigration(input: { fromAccountId: string; toAccountId: string; totalCount: number }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(accountMigrations).values({
				id,
				fromAccountId: input.fromAccountId,
				toAccountId: input.toAccountId,
				totalCount: input.totalCount,
				createdAt: now,
			});
			const created = await this.findMigrationById(id);
			if (!created) throw new Error(`Failed to retrieve account migration after insert: ${id}`);
			return created;
		},

		async updateMigration(
			id: string,
			updates: Partial<{ status: string; migratedCount: number; completedAt: string }>,
		) {
			const set: Record<string, unknown> = {};
			if (updates.status !== undefined) set.status = updates.status;
			if (updates.migratedCount !== undefined) set.migratedCount = updates.migratedCount;
			if (updates.completedAt !== undefined) set.completedAt = updates.completedAt;
			if (Object.keys(set).length === 0) return;

			await db.update(accountMigrations).set(set).where(eq(accountMigrations.id, id));
		},
	};
}
