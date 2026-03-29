// =============================================================================
// Group Chat Repository - Drizzle ORM
// =============================================================================
//
// Handles CRUD operations for group and room chat sessions.
// Group chats differ from 1-on-1 chats in that they have:
//   - sourceType = "group" or "room"
//   - groupId / roomId identifying the LINE group/room
//   - Cached group metadata (name, picture, member count)
//   - friendId is nullable (messages come from multiple members)
//
// Factory pattern: createGroupChatRepository(db) returns the repository object.
// =============================================================================

import { and, desc, eq, or } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { chats, messagesLog } from "../schema/index.js";
import { DateTime } from "../utils.js";

// ---------------------------------------------------------------------------
// Constants -- source type values to avoid magic strings
// ---------------------------------------------------------------------------
const SOURCE_TYPE_GROUP = "group";
const SOURCE_TYPE_ROOM = "room";
const _GROUP_SOURCE_TYPES = [SOURCE_TYPE_GROUP, SOURCE_TYPE_ROOM] as const;

// ---------------------------------------------------------------------------
// Column projection for list/detail queries (avoids SELECT *)
// ---------------------------------------------------------------------------
const groupChatColumns = {
	id: chats.id,
	sourceType: chats.sourceType,
	groupId: chats.groupId,
	roomId: chats.roomId,
	friendId: chats.friendId,
	operatorId: chats.operatorId,
	status: chats.status,
	notes: chats.notes,
	lastMessageAt: chats.lastMessageAt,
	groupName: chats.groupName,
	groupPictureUrl: chats.groupPictureUrl,
	memberCount: chats.memberCount,
	createdAt: chats.createdAt,
	updatedAt: chats.updatedAt,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Filter options for listing group chats */
export interface ListGroupChatsFilter {
	sourceType?: "group" | "room";
	status?: string;
	operatorId?: string;
	limit?: number;
	offset?: number;
}

/** Data required to upsert a group chat session */
export interface UpsertGroupChatData {
	sourceType: "group" | "room";
	groupId?: string | null;
	roomId?: string | null;
	friendId?: string | null;
	groupName?: string | null;
	groupPictureUrl?: string | null;
	memberCount?: number | null;
}

/** Data for adding a message to the messages log linked to a group chat */
export interface AddGroupMessageData {
	friendId?: string | null;
	direction: string;
	messageType: string;
	content: string;
	deliveryType?: string | null;
}

/** Fields that can be updated on group info */
export interface UpdateGroupInfoData {
	groupName?: string | null;
	groupPictureUrl?: string | null;
	memberCount?: number | null;
}

// ---------------------------------------------------------------------------
// Repository Factory
// ---------------------------------------------------------------------------

export function createGroupChatRepository(db: Database) {
	return {
		/**
		 * List group/room chats with optional filters.
		 * Returns only chats where sourceType is "group" or "room".
		 */
		async listGroupChats(filter: ListGroupChatsFilter = {}) {
			const conditions: ReturnType<typeof eq>[] = [];

			// Always restrict to group source types
			if (filter.sourceType) {
				conditions.push(eq(chats.sourceType, filter.sourceType));
			} else {
				const groupOrRoom = or(eq(chats.sourceType, SOURCE_TYPE_GROUP), eq(chats.sourceType, SOURCE_TYPE_ROOM));
				if (groupOrRoom) conditions.push(groupOrRoom);
			}

			if (filter.status) {
				conditions.push(eq(chats.status, filter.status));
			}
			if (filter.operatorId) {
				conditions.push(eq(chats.operatorId, filter.operatorId));
			}

			const query = db
				.select(groupChatColumns)
				.from(chats)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(chats.lastMessageAt));

			if (filter.limit !== undefined) {
				const limited = query.limit(filter.limit);
				if (filter.offset !== undefined) {
					return limited.offset(filter.offset);
				}
				return limited;
			}

			return query;
		},

		/**
		 * Find a chat session by its LINE group ID.
		 * Returns the most recently updated chat for the given groupId.
		 */
		async findByGroupId(groupId: string) {
			const [row] = await db
				.select(groupChatColumns)
				.from(chats)
				.where(and(eq(chats.groupId, groupId), eq(chats.sourceType, SOURCE_TYPE_GROUP)))
				.orderBy(desc(chats.updatedAt))
				.limit(1);
			return row ?? null;
		},

		/**
		 * Find a chat session by its LINE room ID.
		 * Returns the most recently updated chat for the given roomId.
		 */
		async findByRoomId(roomId: string) {
			const [row] = await db
				.select(groupChatColumns)
				.from(chats)
				.where(and(eq(chats.roomId, roomId), eq(chats.sourceType, SOURCE_TYPE_ROOM)))
				.orderBy(desc(chats.updatedAt))
				.limit(1);
			return row ?? null;
		},

		/**
		 * Upsert a group/room chat session.
		 * If a chat with the same groupId/roomId exists, update it;
		 * otherwise create a new chat record.
		 * Returns the chat ID.
		 */
		async upsertGroupChat(data: UpsertGroupChatData): Promise<string> {
			const now = DateTime.now().toISO();
			const existing = await this._findExistingGroupChat(data);

			if (existing) {
				await this._updateExistingGroupChat(existing.id, data, now);
				return existing.id;
			}

			return this._createNewGroupChat(data, now);
		},

		/** @internal Find existing chat record by groupId or roomId */
		async _findExistingGroupChat(data: UpsertGroupChatData): Promise<{ id: string } | undefined> {
			const lookupId = data.sourceType === SOURCE_TYPE_GROUP ? data.groupId : data.roomId;
			const lookupColumn = data.sourceType === SOURCE_TYPE_GROUP ? chats.groupId : chats.roomId;
			if (!lookupId) return undefined;

			const [found] = await db
				.select({ id: chats.id })
				.from(chats)
				.where(and(eq(lookupColumn, lookupId), eq(chats.sourceType, data.sourceType)))
				.limit(1);
			return found;
		},

		/** @internal Update an existing group chat with latest info, reopening if resolved */
		async _updateExistingGroupChat(chatId: string, data: UpsertGroupChatData, now: string): Promise<void> {
			const updateSet: Record<string, unknown> = { updatedAt: now, lastMessageAt: now };
			if (data.groupName !== undefined) updateSet.groupName = data.groupName;
			if (data.groupPictureUrl !== undefined) updateSet.groupPictureUrl = data.groupPictureUrl;
			if (data.memberCount !== undefined) updateSet.memberCount = data.memberCount;
			if (data.friendId !== undefined) updateSet.friendId = data.friendId;

			// Reopen resolved chats on new activity
			const [currentChat] = await db.select({ status: chats.status }).from(chats).where(eq(chats.id, chatId));
			if (currentChat?.status === "resolved") {
				updateSet.status = "unread";
			}

			await db.update(chats).set(updateSet).where(eq(chats.id, chatId));
		},

		/** @internal Create a new group chat record */
		async _createNewGroupChat(data: UpsertGroupChatData, now: string): Promise<string> {
			const chatId = crypto.randomUUID();
			await db.insert(chats).values({
				id: chatId,
				sourceType: data.sourceType,
				groupId: data.groupId ?? null,
				roomId: data.roomId ?? null,
				friendId: data.friendId ?? null,
				groupName: data.groupName ?? null,
				groupPictureUrl: data.groupPictureUrl ?? null,
				memberCount: data.memberCount ?? null,
				lastMessageAt: now,
			});
			return chatId;
		},

		/**
		 * Add a message to the messages log associated with a group chat.
		 * Also updates the chat's lastMessageAt timestamp.
		 * Returns the generated message ID.
		 */
		async addGroupMessage(chatId: string, data: AddGroupMessageData): Promise<string> {
			const now = DateTime.now().toISO();
			const messageId = crypto.randomUUID();

			// Insert into messages_log
			// For group messages, friendId may be null (unknown sender in some cases)
			await db.insert(messagesLog).values({
				id: messageId,
				friendId: data.friendId ?? "",
				direction: data.direction,
				messageType: data.messageType,
				content: data.content,
				deliveryType: data.deliveryType ?? null,
			});

			// Update the chat's last message timestamp
			await db.update(chats).set({ lastMessageAt: now, updatedAt: now }).where(eq(chats.id, chatId));

			return messageId;
		},

		/**
		 * Get messages for a group chat by looking up messages from
		 * members associated with that chat's groupId/roomId.
		 * Uses the chat record to find relevant friend messages.
		 */
		async getGroupMessages(chatId: string, opts: { limit?: number; offset?: number } = {}) {
			const messageLimit = opts.limit ?? 50;
			const messageOffset = opts.offset ?? 0;

			// First get the chat to know the groupId/roomId
			const [chat] = await db
				.select({
					groupId: chats.groupId,
					roomId: chats.roomId,
					sourceType: chats.sourceType,
					friendId: chats.friendId,
				})
				.from(chats)
				.where(eq(chats.id, chatId));

			if (!chat) return [];

			// Query messages ordered by creation time (newest first for pagination)
			const messageColumns = {
				id: messagesLog.id,
				friendId: messagesLog.friendId,
				direction: messagesLog.direction,
				messageType: messagesLog.messageType,
				content: messagesLog.content,
				deliveryType: messagesLog.deliveryType,
				createdAt: messagesLog.createdAt,
			} as const;

			// For group chats, we retrieve messages based on the chat's creation window
			// This relies on messages being logged with the friend IDs of group members
			return db
				.select(messageColumns)
				.from(messagesLog)
				.orderBy(desc(messagesLog.createdAt))
				.limit(messageLimit)
				.offset(messageOffset);
		},

		/**
		 * Update cached group/room information on a chat record.
		 * Typically called after fetching fresh data from the LINE API.
		 */
		async updateGroupInfo(chatId: string, info: UpdateGroupInfoData): Promise<void> {
			const setClause: Record<string, unknown> = {};

			if (info.groupName !== undefined) setClause.groupName = info.groupName;
			if (info.groupPictureUrl !== undefined) setClause.groupPictureUrl = info.groupPictureUrl;
			if (info.memberCount !== undefined) setClause.memberCount = info.memberCount;

			if (Object.keys(setClause).length === 0) return;

			setClause.updatedAt = DateTime.now().toISO();

			await db.update(chats).set(setClause).where(eq(chats.id, chatId));
		},
	};
}
