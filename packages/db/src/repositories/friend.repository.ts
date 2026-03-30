// =============================================================================
// Friend Repository - Drizzle ORM (N+1 solved via JOIN)
// =============================================================================

import type { FriendId, LineAccountId, LineUserId, TagId } from "@line-crm/domain";
import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friends, friendTags, messagesLog, tags } from "../schema/index.js";
import { DateTime } from "../utils.js";

export interface ListFriendsOptions {
	page: number;
	limit: number;
	tagId?: TagId;
	lineAccountId?: LineAccountId;
	search?: string;
	isFollowing?: boolean;
}

export interface FriendWithTags {
	id: string;
	lineUserId: string;
	displayName: string | null;
	pictureUrl: string | null;
	statusMessage: string | null;
	isFollowing: boolean;
	userId: string | null;
	score: number;
	metadata: string | null;
	lineAccountId: string | null;
	createdAt: string;
	updatedAt: string;
	tags: Array<{ id: string; name: string; color: string }>;
}

export function createFriendRepository(db: Database) {
	return {
		/** List friends with tags in a single query (no N+1) */
		async listWithTags(opts: ListFriendsOptions): Promise<{ items: FriendWithTags[]; total: number }> {
			const conditions = [isNull(friends.deletedAt)];

			if (opts.lineAccountId) {
				conditions.push(eq(friends.lineAccountId, opts.lineAccountId));
			}
			if (opts.isFollowing !== undefined) {
				conditions.push(eq(friends.isFollowing, opts.isFollowing));
			}
			if (opts.search) {
				conditions.push(like(friends.displayName, `%${opts.search}%`));
			}

			const offset = (opts.page - 1) * opts.limit;

			// If filtering by tag, resolve friendIds first
			if (opts.tagId) {
				const taggedFriends = await db
					.select({ friendId: friendTags.friendId })
					.from(friendTags)
					.where(eq(friendTags.tagId, opts.tagId));
				const friendIds = taggedFriends.map((r) => r.friendId);
				if (friendIds.length === 0) return { items: [], total: 0 };
				conditions.push(
					sql`${friends.id} IN (${sql.join(
						friendIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);
			}

			const where = and(...conditions);

			// Count + fetch in parallel
			const [countResult, friendRows] = await Promise.all([
				db.select({ count: sql<number>`count(*)` }).from(friends).where(where),
				db.select().from(friends).where(where).orderBy(desc(friends.createdAt)).limit(opts.limit).offset(offset),
			]);
			const total = countResult[0]?.count ?? 0;

			if (friendRows.length === 0) return { items: [], total };

			// Batch load tags for ALL friends in one query (no N+1)
			const friendIdList = friendRows.map((f) => f.id);
			const tagRows = await db
				.select({
					friendId: friendTags.friendId,
					tagId: tags.id,
					tagName: tags.name,
					tagColor: tags.color,
				})
				.from(friendTags)
				.innerJoin(tags, eq(friendTags.tagId, tags.id))
				.where(
					sql`${friendTags.friendId} IN (${sql.join(
						friendIdList.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);

			// Group tags by friendId
			const tagsByFriend = new Map<string, Array<{ id: string; name: string; color: string }>>();
			for (const row of tagRows) {
				const arr = tagsByFriend.get(row.friendId) ?? [];
				arr.push({ id: row.tagId, name: row.tagName, color: row.tagColor });
				tagsByFriend.set(row.friendId, arr);
			}

			const items: FriendWithTags[] = friendRows.map((f) => ({
				...f,
				isFollowing: Boolean(f.isFollowing),
				tags: tagsByFriend.get(f.id) ?? [],
			}));

			return { items, total };
		},

		async findById(id: FriendId): Promise<FriendWithTags | null> {
			const [friend] = await db
				.select()
				.from(friends)
				.where(and(eq(friends.id, id), isNull(friends.deletedAt)));
			if (!friend) return null;

			const tagRows = await db
				.select({ id: tags.id, name: tags.name, color: tags.color })
				.from(friendTags)
				.innerJoin(tags, eq(friendTags.tagId, tags.id))
				.where(eq(friendTags.friendId, id));

			return {
				...friend,
				isFollowing: Boolean(friend.isFollowing),
				tags: tagRows,
			};
		},

		async findByLineUserId(lineUserId: LineUserId): Promise<FriendWithTags | null> {
			const [friend] = await db
				.select()
				.from(friends)
				.where(and(eq(friends.lineUserId, lineUserId), isNull(friends.deletedAt)));
			if (!friend) return null;

			const tagRows = await db
				.select({ id: tags.id, name: tags.name, color: tags.color })
				.from(friendTags)
				.innerJoin(tags, eq(friendTags.tagId, tags.id))
				.where(eq(friendTags.friendId, friend.id));

			return { ...friend, isFollowing: Boolean(friend.isFollowing), tags: tagRows };
		},

		async upsert(data: {
			lineUserId: LineUserId;
			displayName: string | null;
			pictureUrl: string | null;
			statusMessage: string | null;
			lineAccountId?: LineAccountId;
		}): Promise<string> {
			const id = crypto.randomUUID();
			await db
				.insert(friends)
				.values({
					id,
					lineUserId: data.lineUserId,
					displayName: data.displayName,
					pictureUrl: data.pictureUrl,
					statusMessage: data.statusMessage,
					lineAccountId: data.lineAccountId ?? null,
				})
				.onConflictDoUpdate({
					target: friends.lineUserId,
					set: {
						displayName: data.displayName,
						pictureUrl: data.pictureUrl,
						statusMessage: data.statusMessage,
						isFollowing: true,
						updatedAt: DateTime.now().toISO(),
					},
				});
			// Return the actual ID (may differ from generated if conflict)
			const [row] = await db.select({ id: friends.id }).from(friends).where(eq(friends.lineUserId, data.lineUserId));
			return row.id;
		},

		async assignTag(friendId: FriendId, tagId: TagId): Promise<void> {
			await db
				.insert(friendTags)
				.values({
					friendId,
					tagId,
				})
				.onConflictDoNothing();
		},

		async removeTag(friendId: FriendId, tagId: TagId): Promise<void> {
			await db.delete(friendTags).where(and(eq(friendTags.friendId, friendId), eq(friendTags.tagId, tagId)));
		},

		async updateScore(friendId: FriendId, delta: number): Promise<void> {
			await db
				.update(friends)
				.set({ score: sql`${friends.score} + ${delta}` })
				.where(eq(friends.id, friendId));
		},

		async setFollowed(friendId: FriendId): Promise<void> {
			await db
				.update(friends)
				.set({ isFollowing: true, updatedAt: DateTime.now().toISO() })
				.where(eq(friends.id, friendId));
		},

		async setUnfollowed(friendId: FriendId): Promise<void> {
			await db
				.update(friends)
				.set({ isFollowing: false, updatedAt: DateTime.now().toISO() })
				.where(eq(friends.id, friendId));
		},

		async count(lineAccountId?: LineAccountId): Promise<number> {
			const conditions = [isNull(friends.deletedAt)];
			if (lineAccountId) conditions.push(eq(friends.lineAccountId, lineAccountId));
			const result = await db
				.select({ count: sql<number>`count(*)` })
				.from(friends)
				.where(and(...conditions));
			return result[0]?.count ?? 0;
		},

		async updateMetadata(friendId: FriendId, metadata: Record<string, unknown>): Promise<void> {
			await db
				.update(friends)
				.set({ metadata: JSON.stringify(metadata), updatedAt: DateTime.now().toISO() })
				.where(eq(friends.id, friendId));
		},

		async getMetadata(friendId: FriendId): Promise<Record<string, unknown> | null> {
			const [row] = await db.select({ metadata: friends.metadata }).from(friends).where(eq(friends.id, friendId));
			if (!row?.metadata) return null;
			try {
				return JSON.parse(row.metadata as string);
			} catch {
				return null;
			}
		},

		async logMessage(entry: {
			friendId: string;
			direction: "incoming" | "outgoing";
			messageType: string;
			content: string;
			broadcastId?: string | null;
			scenarioStepId?: string | null;
			deliveryType?: string | null;
		}): Promise<void> {
			await db.insert(messagesLog).values({
				id: crypto.randomUUID(),
				friendId: entry.friendId,
				direction: entry.direction,
				messageType: entry.messageType,
				content: entry.content,
				broadcastId: entry.broadcastId ?? null,
				scenarioStepId: entry.scenarioStepId ?? null,
				deliveryType: entry.deliveryType ?? null,
			});
		},

		async getMessages(
			friendId: FriendId,
			limit = 200,
		): Promise<
			Array<{
				id: string;
				direction: string;
				messageType: string;
				content: string;
				createdAt: string | null;
			}>
		> {
			return db
				.select({
					id: messagesLog.id,
					direction: messagesLog.direction,
					messageType: messagesLog.messageType,
					content: messagesLog.content,
					createdAt: messagesLog.createdAt,
				})
				.from(messagesLog)
				.where(eq(messagesLog.friendId, friendId))
				.orderBy(desc(messagesLog.createdAt))
				.limit(limit);
		},
	};
}
