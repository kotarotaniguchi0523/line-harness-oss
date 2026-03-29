import { z } from "zod";

// LINE Messaging API - Message schemas (Zod validated, no SDK)

export const TextMessageSchema = z.object({
	type: z.literal("text"),
	text: z.string().min(1).max(5000),
});

export const ImageMessageSchema = z.object({
	type: z.literal("image"),
	originalContentUrl: z.string().url(),
	previewImageUrl: z.string().url(),
});

export const FlexMessageSchema = z.object({
	type: z.literal("flex"),
	altText: z.string().min(1).max(400),
	contents: z.record(z.unknown()),
});

export const VideoMessageSchema = z.object({
	type: z.literal("video"),
	originalContentUrl: z.string().url(),
	previewImageUrl: z.string().url(),
});

export const MessageSchema = z.discriminatedUnion("type", [
	TextMessageSchema,
	ImageMessageSchema,
	FlexMessageSchema,
	VideoMessageSchema,
]);
export type Message = z.infer<typeof MessageSchema>;

export const PushMessageRequestSchema = z.object({
	to: z.string().min(1),
	messages: z.array(MessageSchema).min(1).max(5),
});

export const ReplyMessageRequestSchema = z.object({
	replyToken: z.string().min(1),
	messages: z.array(MessageSchema).min(1).max(5),
});

export const MulticastRequestSchema = z.object({
	to: z.array(z.string()).min(1).max(500),
	messages: z.array(MessageSchema).min(1).max(5),
});

export const BroadcastRequestSchema = z.object({
	messages: z.array(MessageSchema).min(1).max(5),
});
