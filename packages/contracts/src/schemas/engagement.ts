import { z } from "zod";
import { FriendReminderStatus, MessageType, NotificationStatus } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

// =============================================================================
// Reminder
// =============================================================================
export const ReminderSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	description: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type Reminder = z.infer<typeof ReminderSchema>;

export const CreateReminderSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
});

export const ReminderStepSchema = z.object({
	id: UuidSchema,
	reminderId: UuidSchema,
	offsetMinutes: z.number().int(),
	messageType: MessageType,
	messageContent: z.string().min(1),
	createdAt: IsoDateSchema,
});
export type ReminderStep = z.infer<typeof ReminderStepSchema>;

export const CreateReminderStepSchema = z.object({
	offsetMinutes: z.number().int(),
	messageType: MessageType,
	messageContent: z.string().min(1),
});

export const FriendReminderSchema = z.object({
	id: UuidSchema,
	friendId: UuidSchema,
	reminderId: UuidSchema,
	targetDate: IsoDateSchema,
	status: FriendReminderStatus,
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type FriendReminder = z.infer<typeof FriendReminderSchema>;

// =============================================================================
// Scoring
// =============================================================================
export const ScoringRuleSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	eventType: z.string().min(1),
	scoreValue: z.number().int(),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type ScoringRule = z.infer<typeof ScoringRuleSchema>;

export const CreateScoringRuleSchema = z.object({
	name: z.string().min(1),
	eventType: z.string().min(1),
	scoreValue: z.number().int(),
});
export type CreateScoringRule = z.infer<typeof CreateScoringRuleSchema>;

export const UpdateScoringRuleSchema = z.object({
	name: z.string().min(1).optional(),
	eventType: z.string().min(1).optional(),
	scoreValue: z.number().int().optional(),
	isActive: z.boolean().optional(),
});
export type UpdateScoringRule = z.infer<typeof UpdateScoringRuleSchema>;

export const AddScoreSchema = z.object({
	scoreChange: z.number().int(),
	reason: z.string().optional(),
});
export type AddScore = z.infer<typeof AddScoreSchema>;

export const FriendScoreSchema = z.object({
	id: UuidSchema,
	friendId: UuidSchema,
	scoringRuleId: UuidSchema.nullable(),
	scoreChange: z.number().int(),
	reason: z.string().nullable(),
	createdAt: IsoDateSchema,
});
export type FriendScore = z.infer<typeof FriendScoreSchema>;

// =============================================================================
// Template
// =============================================================================
export const TemplateSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	category: z.string().default("general"),
	messageType: z.string().min(1),
	messageContent: z.string().min(1),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type Template = z.infer<typeof TemplateSchema>;

export const CreateTemplateSchema = z.object({
	name: z.string().min(1),
	category: z.string().optional(),
	messageType: z.string().min(1),
	messageContent: z.string().min(1),
});

// =============================================================================
// Notification
// =============================================================================
export const NotificationRuleSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	eventType: z.string().min(1),
	conditions: z.record(z.unknown()),
	channels: z.array(z.string()),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type NotificationRule = z.infer<typeof NotificationRuleSchema>;

export const NotificationSchema = z.object({
	id: UuidSchema,
	ruleId: UuidSchema.nullable(),
	eventType: z.string(),
	title: z.string(),
	body: z.string(),
	channel: z.string(),
	status: NotificationStatus,
	metadata: z.string().nullable(),
	createdAt: IsoDateSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;
