// =============================================================================
// Ad Platform Repository - Drizzle ORM
// =============================================================================

import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { adConversionLogs, adPlatforms } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createAdPlatformRepository(db: Database) {
	return {
		async list() {
			return db.select().from(adPlatforms).orderBy(desc(adPlatforms.createdAt));
		},

		async findById(id: string) {
			const [row] = await db.select().from(adPlatforms).where(eq(adPlatforms.id, id));
			return row ?? null;
		},

		async findByName(name: string) {
			const [row] = await db.select().from(adPlatforms).where(eq(adPlatforms.name, name));
			return row ?? null;
		},

		async create(input: { name: string; displayName?: string | null; config: Record<string, unknown> }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(adPlatforms).values({
				id,
				name: input.name,
				displayName: input.displayName ?? null,
				config: JSON.stringify(input.config),
				isActive: true,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findById(id);
			if (!created) throw new Error(`Failed to retrieve ad platform after insert: ${id}`);
			return created;
		},

		async update(
			id: string,
			input: { name?: string; displayName?: string | null; config?: Record<string, unknown>; isActive?: boolean },
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (input.name !== undefined) set.name = input.name;
			if (input.displayName !== undefined) set.displayName = input.displayName;
			if (input.config !== undefined) set.config = JSON.stringify(input.config);
			if (input.isActive !== undefined) set.isActive = input.isActive;

			await db.update(adPlatforms).set(set).where(eq(adPlatforms.id, id));
			return this.findById(id);
		},

		async delete(id: string) {
			await db.delete(adPlatforms).where(eq(adPlatforms.id, id));
		},

		async logConversion(opts: {
			platformId: string;
			friendId: string;
			eventName: string;
			clickId: string;
			clickIdType: string;
			status: "sent" | "failed";
			requestBody?: string | null;
			responseBody?: string | null;
			errorMessage?: string | null;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(adConversionLogs).values({
				id,
				adPlatformId: opts.platformId,
				friendId: opts.friendId,
				eventName: opts.eventName,
				clickId: opts.clickId,
				clickIdType: opts.clickIdType,
				status: opts.status,
				requestBody: opts.requestBody ?? null,
				responseBody: opts.responseBody ?? null,
				errorMessage: opts.errorMessage ?? null,
				createdAt: now,
			});
		},

		async getConversionLogs(platformId: string, limit = 50) {
			return db
				.select()
				.from(adConversionLogs)
				.where(eq(adConversionLogs.adPlatformId, platformId))
				.orderBy(desc(adConversionLogs.createdAt))
				.limit(limit);
		},

		async listActive() {
			return db.select().from(adPlatforms).where(eq(adPlatforms.isActive, true));
		},
	};
}
