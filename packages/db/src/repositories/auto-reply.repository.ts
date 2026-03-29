// =============================================================================
// Auto Reply Repository - Drizzle ORM
// Multiple messages per rule (up to MAX_AUTO_REPLY_MESSAGES)
// =============================================================================

import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { autoReplies, autoReplyMessages } from "../schema/index.js";
import { DateTime } from "../utils.js";

/**
 * Maximum messages per auto reply rule.
 * Mirrors MAX_AUTO_REPLY_MESSAGES from @line-crm/contracts.
 * Duplicated here to avoid circular dependency (db -> contracts).
 * LINE API replyMessage supports up to 5 messages per call.
 */
const MAX_AUTO_REPLY_MESSAGES = 5;

// ---------------------------------------------------------------------------
// Column projections — avoids SELECT * and documents exactly what we read
// ---------------------------------------------------------------------------
const replyColumns = {
	id: autoReplies.id,
	keyword: autoReplies.keyword,
	matchType: autoReplies.matchType,
	responseType: autoReplies.responseType,
	responseContent: autoReplies.responseContent,
	isActive: autoReplies.isActive,
	priority: autoReplies.priority,
	lineAccountId: autoReplies.lineAccountId,
	createdAt: autoReplies.createdAt,
	updatedAt: autoReplies.updatedAt,
} as const;

const messageColumns = {
	id: autoReplyMessages.id,
	autoReplyId: autoReplyMessages.autoReplyId,
	messageOrder: autoReplyMessages.messageOrder,
	messageType: autoReplyMessages.messageType,
	messageContent: autoReplyMessages.messageContent,
	createdAt: autoReplyMessages.createdAt,
	updatedAt: autoReplyMessages.updatedAt,
} as const;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createAutoReplyRepository(db: Database) {
	return {
		// ========================================================================
		// Auto Reply CRUD
		// ========================================================================

		/** List auto replies for a given LINE account (+ global rules), ordered by priority desc */
		async list(lineAccountId?: string) {
			const conditions = lineAccountId
				? or(isNull(autoReplies.lineAccountId), eq(autoReplies.lineAccountId, lineAccountId))
				: undefined;

			return db
				.select(replyColumns)
				.from(autoReplies)
				.where(conditions)
				.orderBy(desc(autoReplies.priority), desc(autoReplies.createdAt));
		},

		/** Find a single auto reply by ID */
		async findById(id: string) {
			const [row] = await db.select(replyColumns).from(autoReplies).where(eq(autoReplies.id, id));
			return row ?? null;
		},

		/** Get an auto reply with its ordered messages */
		async getWithMessages(id: string) {
			const [reply] = await db.select(replyColumns).from(autoReplies).where(eq(autoReplies.id, id));

			if (!reply) return null;

			const messages = await db
				.select(messageColumns)
				.from(autoReplyMessages)
				.where(eq(autoReplyMessages.autoReplyId, id))
				.orderBy(asc(autoReplyMessages.messageOrder));

			return { ...reply, messages };
		},

		/** Create a new auto reply with optional messages, returns generated ID */
		async create(data: {
			keyword: string;
			matchType?: string;
			responseType?: string;
			responseContent?: string;
			isActive?: boolean;
			priority?: number;
			lineAccountId?: string | null;
			messages?: Array<{ messageType: string; messageContent: string }>;
		}): Promise<string> {
			const id = crypto.randomUUID();
			const msgs = data.messages ?? [];

			// Use first message as legacy responseContent for backward compat
			const firstContent = msgs.length > 0 ? msgs[0].messageContent : (data.responseContent ?? "");
			const firstType = msgs.length > 0 ? msgs[0].messageType : (data.responseType ?? "text");

			await db.insert(autoReplies).values({
				id,
				keyword: data.keyword,
				matchType: data.matchType ?? "exact",
				responseType: firstType,
				responseContent: firstContent,
				isActive: data.isActive ?? true,
				priority: data.priority ?? 0,
				lineAccountId: data.lineAccountId ?? null,
			});

			// Insert messages in order, capped at MAX_AUTO_REPLY_MESSAGES
			const cappedMessages = msgs.slice(0, MAX_AUTO_REPLY_MESSAGES);
			for (let i = 0; i < cappedMessages.length; i++) {
				const msg = cappedMessages[i];
				await db.insert(autoReplyMessages).values({
					id: crypto.randomUUID(),
					autoReplyId: id,
					messageOrder: i + 1,
					messageType: msg.messageType,
					messageContent: msg.messageContent,
				});
			}

			return id;
		},

		/** Partial update of auto reply fields */
		async update(
			id: string,
			updates: Partial<{
				keyword: string;
				matchType: string;
				isActive: boolean;
				priority: number;
				lineAccountId: string | null;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.keyword !== undefined) setClause.keyword = updates.keyword;
			if (updates.matchType !== undefined) setClause.matchType = updates.matchType;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;
			if (updates.priority !== undefined) setClause.priority = updates.priority;
			if (updates.lineAccountId !== undefined) setClause.lineAccountId = updates.lineAccountId;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(autoReplies).set(setClause).where(eq(autoReplies.id, id));
		},

		/** Hard-delete an auto reply and its child messages */
		async delete(id: string): Promise<void> {
			await db.delete(autoReplyMessages).where(eq(autoReplyMessages.autoReplyId, id));
			await db.delete(autoReplies).where(eq(autoReplies.id, id));
		},

		// ========================================================================
		// Auto Reply Messages CRUD
		// ========================================================================

		/** Add a message to an auto reply (validates max count) */
		async addMessage(
			autoReplyId: string,
			msg: { messageType: string; messageContent: string },
		): Promise<string | null> {
			// Check current count
			const existing = await db
				.select(messageColumns)
				.from(autoReplyMessages)
				.where(eq(autoReplyMessages.autoReplyId, autoReplyId))
				.orderBy(asc(autoReplyMessages.messageOrder));

			if (existing.length >= MAX_AUTO_REPLY_MESSAGES) {
				return null; // Max messages reached
			}

			const nextOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.messageOrder)) + 1 : 1;

			const id = crypto.randomUUID();
			await db.insert(autoReplyMessages).values({
				id,
				autoReplyId,
				messageOrder: nextOrder,
				messageType: msg.messageType,
				messageContent: msg.messageContent,
			});

			// Sync legacy responseContent/responseType with first message
			await this._syncLegacyFields(autoReplyId);

			return id;
		},

		/** Remove a message by ID */
		async removeMessage(messageId: string): Promise<void> {
			const [msg] = await db
				.select({ autoReplyId: autoReplyMessages.autoReplyId })
				.from(autoReplyMessages)
				.where(eq(autoReplyMessages.id, messageId));

			await db.delete(autoReplyMessages).where(eq(autoReplyMessages.id, messageId));

			if (msg) {
				// Recompact ordering after deletion
				const remaining = await db
					.select(messageColumns)
					.from(autoReplyMessages)
					.where(eq(autoReplyMessages.autoReplyId, msg.autoReplyId))
					.orderBy(asc(autoReplyMessages.messageOrder));

				for (let i = 0; i < remaining.length; i++) {
					await db
						.update(autoReplyMessages)
						.set({ messageOrder: i + 1, updatedAt: DateTime.now().toISO() })
						.where(eq(autoReplyMessages.id, remaining[i].id));
				}

				await this._syncLegacyFields(msg.autoReplyId);
			}
		},

		/** Reorder messages within an auto reply */
		async reorderMessages(autoReplyId: string, orderedIds: string[]): Promise<void> {
			const capped = orderedIds.slice(0, MAX_AUTO_REPLY_MESSAGES);
			for (let i = 0; i < capped.length; i++) {
				await db
					.update(autoReplyMessages)
					.set({ messageOrder: i + 1, updatedAt: DateTime.now().toISO() })
					.where(and(eq(autoReplyMessages.id, capped[i]), eq(autoReplyMessages.autoReplyId, autoReplyId)));
			}

			await this._syncLegacyFields(autoReplyId);
		},

		// ========================================================================
		// Keyword Matching (used by webhook handler)
		// ========================================================================

		/**
		 * Find all active auto replies matching a keyword for a given account,
		 * ordered by priority desc. Returns each reply with its ordered messages.
		 */
		async findMatchingReplies(keyword: string, lineAccountId: string | null) {
			const accountCondition = lineAccountId
				? or(isNull(autoReplies.lineAccountId), eq(autoReplies.lineAccountId, lineAccountId))
				: isNull(autoReplies.lineAccountId);

			const activeReplies = await db
				.select(replyColumns)
				.from(autoReplies)
				.where(and(eq(autoReplies.isActive, true), accountCondition))
				.orderBy(desc(autoReplies.priority), asc(autoReplies.createdAt));

			for (const rule of activeReplies) {
				const isMatch = rule.matchType === "exact" ? keyword === rule.keyword : keyword.includes(rule.keyword);

				if (isMatch) {
					// Load ordered messages for the matched rule
					const messages = await db
						.select(messageColumns)
						.from(autoReplyMessages)
						.where(eq(autoReplyMessages.autoReplyId, rule.id))
						.orderBy(asc(autoReplyMessages.messageOrder));

					return { rule, messages };
				}
			}

			return null;
		},

		// ========================================================================
		// Internal helpers
		// ========================================================================

		/** Keep legacy responseContent/responseType in sync with first message */
		async _syncLegacyFields(autoReplyId: string): Promise<void> {
			const [first] = await db
				.select(messageColumns)
				.from(autoReplyMessages)
				.where(eq(autoReplyMessages.autoReplyId, autoReplyId))
				.orderBy(asc(autoReplyMessages.messageOrder))
				.limit(1);

			if (first) {
				await db
					.update(autoReplies)
					.set({
						responseType: first.messageType,
						responseContent: first.messageContent,
						updatedAt: DateTime.now().toISO(),
					})
					.where(eq(autoReplies.id, autoReplyId));
			}
		},
	};
}
