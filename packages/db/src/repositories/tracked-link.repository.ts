// =============================================================================
// Tracked Link Repository - Drizzle ORM
// =============================================================================

import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friends, linkClicks, trackedLinks } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createTrackedLinkRepository(db: Database) {
	return {
		async list() {
			return db.select().from(trackedLinks).orderBy(desc(trackedLinks.createdAt));
		},

		async findById(id: string) {
			const [row] = await db.select().from(trackedLinks).where(eq(trackedLinks.id, id));
			return row ?? null;
		},

		async create(input: { name: string; originalUrl: string; tagId?: string | null; scenarioId?: string | null }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(trackedLinks).values({
				id,
				name: input.name,
				originalUrl: input.originalUrl,
				tagId: input.tagId ?? null,
				scenarioId: input.scenarioId ?? null,
				isActive: true,
				clickCount: 0,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findById(id);
			if (!created) throw new Error(`Failed to retrieve tracked link after insert: ${id}`);
			return created;
		},

		async delete(id: string) {
			await db.delete(trackedLinks).where(eq(trackedLinks.id, id));
		},

		async recordClick(trackedLinkId: string, friendId?: string | null) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(linkClicks).values({
				id,
				trackedLinkId,
				friendId: friendId ?? null,
				clickedAt: now,
			});
			await db
				.update(trackedLinks)
				.set({
					clickCount: sql`${trackedLinks.clickCount} + 1`,
					updatedAt: now,
				})
				.where(eq(trackedLinks.id, trackedLinkId));

			const [created] = await db.select().from(linkClicks).where(eq(linkClicks.id, id));
			if (!created) throw new Error(`Failed to retrieve link click after insert: ${id}`);
			return created;
		},

		async getClicks(trackedLinkId: string) {
			return db
				.select({
					id: linkClicks.id,
					trackedLinkId: linkClicks.trackedLinkId,
					friendId: linkClicks.friendId,
					clickedAt: linkClicks.clickedAt,
					friendDisplayName: friends.displayName,
				})
				.from(linkClicks)
				.leftJoin(friends, eq(linkClicks.friendId, friends.id))
				.where(eq(linkClicks.trackedLinkId, trackedLinkId))
				.orderBy(desc(linkClicks.clickedAt));
		},
	};
}
