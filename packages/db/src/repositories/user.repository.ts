// =============================================================================
// User Repository - Drizzle ORM
// =============================================================================

import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friends, users } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createUserRepository(db: Database) {
	return {
		async list() {
			return db.select().from(users).orderBy(desc(users.createdAt));
		},

		async findById(id: string) {
			const [row] = await db.select().from(users).where(eq(users.id, id));
			return row ?? null;
		},

		async findByEmail(email: string) {
			const [row] = await db.select().from(users).where(eq(users.email, email));
			return row ?? null;
		},

		async create(input: {
			email?: string | null;
			phone?: string | null;
			externalId?: string | null;
			displayName?: string | null;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(users).values({
				id,
				email: input.email ?? null,
				phone: input.phone ?? null,
				externalId: input.externalId ?? null,
				displayName: input.displayName ?? null,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findById(id);
			if (!created) throw new Error(`Failed to retrieve user after insert: ${id}`);
			return created;
		},

		async update(
			id: string,
			updates: Partial<{
				email: string | null;
				phone: string | null;
				externalId: string | null;
				displayName: string | null;
			}>,
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (updates.email !== undefined) set.email = updates.email;
			if (updates.phone !== undefined) set.phone = updates.phone;
			if (updates.externalId !== undefined) set.externalId = updates.externalId;
			if (updates.displayName !== undefined) set.displayName = updates.displayName;

			await db.update(users).set(set).where(eq(users.id, id));
			return this.findById(id);
		},

		async delete(id: string) {
			await db.delete(users).where(eq(users.id, id));
		},

		async linkFriend(friendId: string, userId: string) {
			await db.update(friends).set({ userId, updatedAt: DateTime.now().toISO() }).where(eq(friends.id, friendId));
		},

		async getUserFriends(userId: string) {
			return db
				.select({
					id: friends.id,
					lineUserId: friends.lineUserId,
					displayName: friends.displayName,
					isFollowing: friends.isFollowing,
				})
				.from(friends)
				.where(eq(friends.userId, userId));
		},
	};
}
