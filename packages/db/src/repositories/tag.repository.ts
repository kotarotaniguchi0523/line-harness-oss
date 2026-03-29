// =============================================================================
// Tag Repository - Drizzle ORM
// =============================================================================

import type { FriendId, TagId } from "@line-crm/domain";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friends, friendTags, tags } from "../schema/index.js";

export function createTagRepository(db: Database) {
	const tagColumns = {
		id: tags.id,
		name: tags.name,
		color: tags.color,
		createdAt: tags.createdAt,
	} as const;

	return {
		/** List all tags ordered by name */
		async list() {
			return db.select(tagColumns).from(tags).orderBy(asc(tags.name));
		},

		/** Find a single tag by ID */
		async findById(id: TagId) {
			const [row] = await db.select(tagColumns).from(tags).where(eq(tags.id, id));
			return row ?? null;
		},

		/** Create a new tag, returns the generated ID */
		async create(data: { name: string; color?: string }): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(tags).values({
				id,
				name: data.name,
				color: data.color ?? "#3B82F6",
			});
			return id;
		},

		/** Hard-delete a tag (tags have no soft delete column) */
		async delete(id: TagId): Promise<void> {
			await db.delete(tags).where(eq(tags.id, id));
		},

		/** Assign a tag to a friend (idempotent) */
		async assignToFriend(friendId: FriendId, tagId: TagId): Promise<void> {
			await db.insert(friendTags).values({ friendId, tagId }).onConflictDoNothing();
		},

		/** Remove a tag from a friend */
		async removeFromFriend(friendId: FriendId, tagId: TagId): Promise<void> {
			await db.delete(friendTags).where(and(eq(friendTags.friendId, friendId), eq(friendTags.tagId, tagId)));
		},

		/** Get all tags for a given friend */
		async getByFriend(friendId: FriendId) {
			return db
				.select({
					id: tags.id,
					name: tags.name,
					color: tags.color,
					createdAt: tags.createdAt,
				})
				.from(friendTags)
				.innerJoin(tags, eq(friendTags.tagId, tags.id))
				.where(eq(friendTags.friendId, friendId))
				.orderBy(asc(tags.name));
		},

		/** Get all friends that have a given tag (soft-delete filtered) */
		async getFriendsByTag(tagId: TagId) {
			return db
				.select({
					id: friends.id,
					lineUserId: friends.lineUserId,
					displayName: friends.displayName,
					pictureUrl: friends.pictureUrl,
					statusMessage: friends.statusMessage,
					isFollowing: friends.isFollowing,
					score: friends.score,
					lineAccountId: friends.lineAccountId,
					createdAt: friends.createdAt,
				})
				.from(friendTags)
				.innerJoin(friends, eq(friendTags.friendId, friends.id))
				.where(eq(friendTags.tagId, tagId));
		},
	};
}
