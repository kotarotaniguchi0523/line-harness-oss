// =============================================================================
// Auto Reply Schemas — Multi-message support (up to DOMAIN_LIMITS.maxAutoReplyMessages)
// =============================================================================
//
// Each auto-reply rule can send 1-5 messages via LINE replyMessage API.
// Messages are ordered by messageOrder and sent as an array in a single reply.
//
// The legacy single-message fields (responseType/responseContent) on auto_replies
// are kept in sync with the first message for backward compatibility.
// =============================================================================

import { z } from "zod";
import { DOMAIN_LIMITS } from "../constants.js";
import { AutoReplyMatchType, MessageType } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

// ---------------------------------------------------------------------------
// Auto Reply Message (child of auto reply)
// ---------------------------------------------------------------------------
export const AutoReplyMessageSchema = z.object({
	id: UuidSchema,
	autoReplyId: UuidSchema,
	messageOrder: z.number().int().min(1).max(DOMAIN_LIMITS.maxAutoReplyMessages),
	messageType: MessageType,
	messageContent: z.string().min(1),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type AutoReplyMessage = z.infer<typeof AutoReplyMessageSchema>;

// ---------------------------------------------------------------------------
// Auto Reply (parent) — updated with priority and messages relation
// ---------------------------------------------------------------------------
export const AutoReplyWithMessagesSchema = z.object({
	id: UuidSchema,
	keyword: z.string().min(1),
	matchType: AutoReplyMatchType,
	responseType: MessageType,
	responseContent: z.string(),
	isActive: z.boolean(),
	priority: z.number().int().default(0),
	lineAccountId: UuidSchema.nullable(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
	messages: z.array(AutoReplyMessageSchema),
});
export type AutoReplyWithMessages = z.infer<typeof AutoReplyWithMessagesSchema>;

// ---------------------------------------------------------------------------
// Create / Update request schemas
// ---------------------------------------------------------------------------

/** Input for a single message within a multi-message auto reply */
export const AutoReplyMessageInputSchema = z.object({
	messageType: MessageType,
	messageContent: z.string().min(1),
});
export type AutoReplyMessageInput = z.infer<typeof AutoReplyMessageInputSchema>;

/**
 * Schema for creating a new auto reply with multi-message support.
 * The messages array is ordered: first element = messageOrder 1, etc.
 */
export const CreateAutoReplySchema = z.object({
	keyword: z.string().min(1),
	matchType: AutoReplyMatchType.default("exact"),
	isActive: z.boolean().default(true),
	priority: z.number().int().default(0),
	lineAccountId: z.string().uuid().optional(),
	messages: z
		.array(AutoReplyMessageInputSchema)
		.min(1, "最低1つのメッセージが必要です")
		.max(DOMAIN_LIMITS.maxAutoReplyMessages, `最大${DOMAIN_LIMITS.maxAutoReplyMessages}メッセージまで`),
});
export type CreateAutoReply = z.infer<typeof CreateAutoReplySchema>;

/**
 * Schema for updating an existing auto reply.
 * Messages can be provided to fully replace the current message set.
 */
export const UpdateAutoReplySchema = z.object({
	keyword: z.string().min(1).optional(),
	matchType: AutoReplyMatchType.optional(),
	isActive: z.boolean().optional(),
	priority: z.number().int().optional(),
	lineAccountId: z.string().uuid().nullable().optional(),
	messages: z
		.array(AutoReplyMessageInputSchema)
		.min(1, "最低1つのメッセージが必要です")
		.max(DOMAIN_LIMITS.maxAutoReplyMessages, `最大${DOMAIN_LIMITS.maxAutoReplyMessages}メッセージまで`)
		.optional(),
});
export type UpdateAutoReply = z.infer<typeof UpdateAutoReplySchema>;

/** Schema for reordering messages (array of message IDs in desired order) */
export const ReorderAutoReplyMessagesSchema = z.object({
	orderedIds: z.array(z.string().uuid()).min(1).max(DOMAIN_LIMITS.maxAutoReplyMessages),
});
export type ReorderAutoReplyMessages = z.infer<typeof ReorderAutoReplyMessagesSchema>;
