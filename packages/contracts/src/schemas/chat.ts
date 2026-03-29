import { z } from "zod";
import { AutoReplyMatchType, ChatStatus, MessageDirection, MessageType, OperatorRole } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

export const OperatorSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	email: z.string().email(),
	role: OperatorRole,
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type Operator = z.infer<typeof OperatorSchema>;

export const ChatSchema = z.object({
	id: UuidSchema,
	friendId: UuidSchema,
	operatorId: UuidSchema.nullable(),
	status: ChatStatus,
	notes: z.string().nullable(),
	lastMessageAt: IsoDateSchema.nullable(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type Chat = z.infer<typeof ChatSchema>;

export const MessageLogSchema = z.object({
	id: UuidSchema,
	friendId: UuidSchema,
	direction: MessageDirection,
	messageType: z.string(),
	content: z.string(),
	broadcastId: UuidSchema.nullable(),
	scenarioStepId: UuidSchema.nullable(),
	deliveryType: z.string().nullable(),
	createdAt: IsoDateSchema,
});
export type MessageLog = z.infer<typeof MessageLogSchema>;

export const AutoReplySchema = z.object({
	id: UuidSchema,
	keyword: z.string().min(1),
	matchType: AutoReplyMatchType,
	responseType: MessageType,
	responseContent: z.string().min(1),
	isActive: z.boolean(),
	lineAccountId: UuidSchema.nullable(),
	createdAt: IsoDateSchema,
});
export type AutoReply = z.infer<typeof AutoReplySchema>;

// =============================================================================
// Chat — Request Schemas
// =============================================================================

/**
 * Schema for creating a new operator.
 * Used by POST /api/operators
 */
export const CreateOperatorSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	role: OperatorRole.optional(),
});
export type CreateOperatorRequest = z.infer<typeof CreateOperatorSchema>;

/**
 * Schema for creating a new chat session.
 * Used by POST /api/chats
 */
export const CreateChatSchema = z.object({
	friendId: z.string().uuid(),
	operatorId: z.string().uuid().optional(),
	lineAccountId: z.string().uuid().nullable().optional(),
});
export type CreateChatRequest = z.infer<typeof CreateChatSchema>;

/**
 * Schema for updating a chat (assign operator, change status, add notes).
 * Used by PUT /api/chats/:id
 */
export const UpdateChatSchema = z.object({
	operatorId: z.string().uuid().nullable().optional(),
	status: ChatStatus.optional(),
	notes: z.string().optional(),
});
export type UpdateChatRequest = z.infer<typeof UpdateChatSchema>;

/**
 * Schema for sending a message from an operator.
 * Used by POST /api/chats/:id/send
 */
export const SendChatMessageSchema = z.object({
	messageType: MessageType.optional(),
	content: z.string().min(1),
});
export type SendChatMessageRequest = z.infer<typeof SendChatMessageSchema>;
