// =============================================================================
// Chat Repository - Drizzle ORM
// =============================================================================

import type { ChatId, FriendId, OperatorId } from "@line-crm/domain";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { chats, operators } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createChatRepository(db: Database) {
	const chatColumns = {
		id: chats.id,
		friendId: chats.friendId,
		operatorId: chats.operatorId,
		status: chats.status,
		notes: chats.notes,
		lastMessageAt: chats.lastMessageAt,
		createdAt: chats.createdAt,
		updatedAt: chats.updatedAt,
	} as const;

	return {
		/** List chats with optional status/operator filters */
		async listChats(opts: { status?: string; operatorId?: OperatorId } = {}) {
			const conditions: ReturnType<typeof eq>[] = [];
			if (opts.status) conditions.push(eq(chats.status, opts.status));
			if (opts.operatorId) conditions.push(eq(chats.operatorId, opts.operatorId));

			return db
				.select(chatColumns)
				.from(chats)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(chats.lastMessageAt));
		},

		/** Get a chat by ID with friend and operator info */
		async getChatDetail(id: ChatId) {
			const [row] = await db
				.select({
					id: chats.id,
					friendId: chats.friendId,
					operatorId: chats.operatorId,
					status: chats.status,
					notes: chats.notes,
					lastMessageAt: chats.lastMessageAt,
					createdAt: chats.createdAt,
					updatedAt: chats.updatedAt,
					operatorName: operators.name,
					operatorEmail: operators.email,
				})
				.from(chats)
				.leftJoin(operators, eq(chats.operatorId, operators.id))
				.where(eq(chats.id, id));
			return row ?? null;
		},

		/** Find the most recent chat for a friend */
		async findByFriendId(friendId: FriendId) {
			const [row] = await db
				.select(chatColumns)
				.from(chats)
				.where(eq(chats.friendId, friendId))
				.orderBy(desc(chats.createdAt))
				.limit(1);
			return row ?? null;
		},

		/** Create a new chat session, returns the generated ID */
		async createChat(data: { friendId: FriendId; operatorId?: OperatorId }): Promise<string> {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(chats).values({
				id,
				friendId: data.friendId,
				operatorId: data.operatorId ?? null,
				lastMessageAt: now,
			});
			return id;
		},

		/** Update chat status, operator assignment, notes, or last message time */
		async updateChatStatus(
			id: ChatId,
			updates: Partial<{
				operatorId: string | null;
				status: string;
				notes: string;
				lastMessageAt: string;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.operatorId !== undefined) setClause.operatorId = updates.operatorId;
			if (updates.status !== undefined) setClause.status = updates.status;
			if (updates.notes !== undefined) setClause.notes = updates.notes;
			if (updates.lastMessageAt !== undefined) setClause.lastMessageAt = updates.lastMessageAt;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(chats).set(setClause).where(eq(chats.id, id));
		},

		/** Upsert: create or reopen chat when a friend sends a message */
		async upsertOnMessage(friendId: FriendId): Promise<string> {
			const existing = await db
				.select(chatColumns)
				.from(chats)
				.where(eq(chats.friendId, friendId))
				.orderBy(desc(chats.createdAt))
				.limit(1);

			const now = DateTime.now().toISO();

			if (existing.length > 0) {
				const chat = existing[0];
				const newStatus = chat.status === "resolved" ? "unread" : chat.status;
				await db
					.update(chats)
					.set({ status: newStatus, lastMessageAt: now, updatedAt: now })
					.where(eq(chats.id, chat.id));
				return chat.id;
			}

			const id = crypto.randomUUID();
			await db.insert(chats).values({
				id,
				friendId,
				lastMessageAt: now,
			});
			return id;
		},
	};
}
