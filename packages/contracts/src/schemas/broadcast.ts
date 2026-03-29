import { z } from "zod";
import { BroadcastStatus, BroadcastTargetType, MessageType } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

// =============================================================================
// Broadcast Config (性質 -- 作成時に決定、以後不変)
// =============================================================================

export const BroadcastConfigSchema = z.object({
	id: UuidSchema,
	title: z.string().min(1),
	messageType: MessageType,
	messageContent: z.string().min(1),
	targetType: BroadcastTargetType,
	targetTagId: UuidSchema.nullable(),
	lineAccountId: UuidSchema.nullable(),
	createdAt: IsoDateSchema,
});
export type BroadcastConfig = z.infer<typeof BroadcastConfigSchema>;

// =============================================================================
// Broadcast State (状態 -- 時間とともに変化する)
// =============================================================================

export const BroadcastStateSchema = z.object({
	status: BroadcastStatus,
	scheduledAt: IsoDateSchema.nullable(),
	sentAt: IsoDateSchema.nullable(),
	totalCount: z.number().int().nonnegative(),
	successCount: z.number().int().nonnegative(),
	deletedAt: IsoDateSchema.nullable().optional(),
});
export type BroadcastState = z.infer<typeof BroadcastStateSchema>;

// =============================================================================
// Broadcast Read (性質 + 状態の合成)
// =============================================================================

export const BroadcastSchema = BroadcastConfigSchema.merge(BroadcastStateSchema);
export type Broadcast = z.infer<typeof BroadcastSchema>;

// =============================================================================
// Create (性質のみ -- 状態は初期値で自動設定)
// =============================================================================

export const CreateBroadcastSchema = BroadcastConfigSchema.omit({
	id: true,
	createdAt: true,
})
	.extend({
		scheduledAt: IsoDateSchema.optional(),
	})
	.superRefine((input, ctx) => {
		if (input.targetType === "tag" && !input.targetTagId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["targetTagId"],
				message: "targetTagId is required when targetType is tag",
			});
		}
	});
export type CreateBroadcast = z.infer<typeof CreateBroadcastSchema>;

// =============================================================================
// Update (性質の部分更新 -- Config フィールドのみ変更可能)
// =============================================================================

export const UpdateBroadcastSchema = z.object({
	title: z.string().min(1).optional(),
	messageType: MessageType.optional(),
	messageContent: z.string().min(1).optional(),
	targetType: BroadcastTargetType.optional(),
	targetTagId: UuidSchema.nullable().optional(),
	scheduledAt: IsoDateSchema.nullable().optional(),
});
export type UpdateBroadcast = z.infer<typeof UpdateBroadcastSchema>;

// =============================================================================
// Segment Condition (broadcast targeting rules)
// =============================================================================

export const SegmentConditionSchema: z.ZodType = z.lazy(() =>
	z.object({
		operator: z.enum(["and", "or"]),
		rules: z.array(
			z.union([
				z.object({
					field: z.string().min(1),
					op: z.string().min(1),
					value: z.unknown(),
				}),
				SegmentConditionSchema,
			]),
		),
	}),
);
export type SegmentCondition = z.infer<typeof SegmentConditionSchema>;
