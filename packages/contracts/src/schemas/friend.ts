import { z } from "zod";
import { HexColorSchema, IsoDateSchema, UuidSchema } from "./common.js";

// =============================================================================
// Friend Identity (性質 -- 識別情報、不変)
// =============================================================================

export const FriendIdentitySchema = z.object({
	id: UuidSchema,
	lineUserId: z.string().min(1),
	lineAccountId: UuidSchema.nullable(),
	createdAt: IsoDateSchema,
});
export type FriendIdentity = z.infer<typeof FriendIdentitySchema>;

// =============================================================================
// Friend State (状態 -- プロフィール + エンゲージメント、変化する)
// =============================================================================

export const FriendStateSchema = z.object({
	displayName: z.string().nullable(),
	pictureUrl: z.string().url().nullable(),
	statusMessage: z.string().nullable(),
	isFollowing: z.boolean(),
	userId: UuidSchema.nullable(),
	score: z.number().int().default(0),
	metadata: z.record(z.unknown()).nullable(),
	updatedAt: IsoDateSchema,
	deletedAt: IsoDateSchema.nullable().optional(),
});
export type FriendState = z.infer<typeof FriendStateSchema>;

// =============================================================================
// Friend Read (性質 + 状態の合成)
// =============================================================================

export const FriendSchema = FriendIdentitySchema.merge(FriendStateSchema);
export type Friend = z.infer<typeof FriendSchema>;

// =============================================================================
// Create (性質のみ -- 状態は初期値で自動設定)
// =============================================================================

export const CreateFriendSchema = FriendIdentitySchema.pick({
	lineUserId: true,
}).extend({
	displayName: z.string().nullable(),
	pictureUrl: z.string().url().nullable(),
	statusMessage: z.string().nullable(),
	lineAccountId: UuidSchema.optional(),
});
export type CreateFriend = z.infer<typeof CreateFriendSchema>;

// =============================================================================
// Tag
// =============================================================================

export const TagSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	color: HexColorSchema.default("#3B82F6"),
	createdAt: IsoDateSchema,
});
export type Tag = z.infer<typeof TagSchema>;

export const CreateTagSchema = z.object({
	name: z.string().min(1),
	color: HexColorSchema.optional(),
});
export type CreateTag = z.infer<typeof CreateTagSchema>;

// =============================================================================
// FriendTag
// =============================================================================

export const FriendTagSchema = z.object({
	friendId: UuidSchema,
	tagId: UuidSchema,
	assignedAt: IsoDateSchema,
});
export type FriendTag = z.infer<typeof FriendTagSchema>;

export const AssignTagSchema = z.object({
	tagId: UuidSchema,
});
export type AssignTag = z.infer<typeof AssignTagSchema>;

export const FriendMetadataSchema = z.record(z.unknown());
export type FriendMetadata = z.infer<typeof FriendMetadataSchema>;

export const SendFriendMessageSchema = z.object({
	messageType: z.string().min(1).optional(),
	content: z.string().min(1),
});
export type SendFriendMessage = z.infer<typeof SendFriendMessageSchema>;

// =============================================================================
// Friend with Tags (composite)
// =============================================================================

export const FriendWithTagsSchema = FriendSchema.extend({
	tags: z.array(TagSchema),
});
export type FriendWithTags = z.infer<typeof FriendWithTagsSchema>;
