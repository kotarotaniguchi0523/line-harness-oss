import { z } from "zod";
import { FriendScenarioStatus, MessageType, ScenarioTriggerType } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

// =============================================================================
// Scenario Config (性質 -- 作成時に決定、以後不変)
// =============================================================================

export const ScenarioConfigSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	description: z.string().nullable(),
	triggerType: ScenarioTriggerType,
	triggerTagId: UuidSchema.nullable(),
	lineAccountId: UuidSchema.nullable(),
	createdAt: IsoDateSchema,
});
export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>;

// =============================================================================
// Scenario State (状態 -- 時間とともに変化する)
// =============================================================================

export const ScenarioStateSchema = z.object({
	isActive: z.boolean(),
	updatedAt: IsoDateSchema,
	deletedAt: IsoDateSchema.nullable().optional(),
});
export type ScenarioState = z.infer<typeof ScenarioStateSchema>;

// =============================================================================
// Scenario Read (性質 + 状態の合成)
// =============================================================================

export const ScenarioSchema = ScenarioConfigSchema.merge(ScenarioStateSchema);
export type Scenario = z.infer<typeof ScenarioSchema>;

// =============================================================================
// Create (性質のみ -- 状態は初期値で自動設定)
// =============================================================================

export const CreateScenarioSchema = ScenarioConfigSchema.omit({
	id: true,
	createdAt: true,
}).extend({
	description: z.string().optional(),
	triggerTagId: UuidSchema.optional(),
	isActive: z.boolean().optional(),
	lineAccountId: UuidSchema.optional(),
});
export type CreateScenario = z.infer<typeof CreateScenarioSchema>;

// =============================================================================
// Update (性質 + 状態の部分更新)
// =============================================================================

export const UpdateScenarioSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	triggerType: ScenarioTriggerType.optional(),
	triggerTagId: UuidSchema.nullable().optional(),
	isActive: z.boolean().optional(),
});
export type UpdateScenario = z.infer<typeof UpdateScenarioSchema>;

// =============================================================================
// ScenarioStep Config (性質 -- ステップ定義、不変)
// =============================================================================

export const ScenarioStepConfigSchema = z.object({
	id: UuidSchema,
	scenarioId: UuidSchema,
	stepOrder: z.number().int().nonnegative(),
	delayMinutes: z.number().int().nonnegative().default(0),
	messageType: MessageType,
	messageContent: z.string().min(1),
	conditionType: z.string().nullable().optional(),
	conditionValue: z.string().nullable().optional(),
	nextStepOnFalse: z.number().int().nullable().optional(),
	createdAt: IsoDateSchema,
});
export type ScenarioStepConfig = z.infer<typeof ScenarioStepConfigSchema>;

// ScenarioStep read schema (currently identical to config -- state may be added later)
export const ScenarioStepSchema = ScenarioStepConfigSchema;
export type ScenarioStep = z.infer<typeof ScenarioStepSchema>;

// =============================================================================
// Create / Update ScenarioStep
// =============================================================================

export const CreateScenarioStepSchema = z.object({
	stepOrder: z.number().int().nonnegative(),
	delayMinutes: z.number().int().nonnegative().default(0),
	messageType: MessageType,
	messageContent: z.string().min(1),
	conditionType: z.string().optional(),
	conditionValue: z.string().optional(),
	nextStepOnFalse: z.number().int().optional(),
});
export type CreateScenarioStep = z.infer<typeof CreateScenarioStepSchema>;

export const UpdateScenarioStepSchema = z.object({
	stepOrder: z.number().int().nonnegative().optional(),
	delayMinutes: z.number().int().nonnegative().optional(),
	messageType: MessageType.optional(),
	messageContent: z.string().min(1).optional(),
	conditionType: z.string().nullable().optional(),
	conditionValue: z.string().nullable().optional(),
	nextStepOnFalse: z.number().int().nullable().optional(),
});
export type UpdateScenarioStep = z.infer<typeof UpdateScenarioStepSchema>;

// =============================================================================
// FriendScenario (enrollment/progress -- 状態のみ)
// =============================================================================

export const FriendScenarioSchema = z.object({
	id: UuidSchema,
	friendId: UuidSchema,
	scenarioId: UuidSchema,
	currentStepOrder: z.number().int().nonnegative(),
	status: FriendScenarioStatus,
	startedAt: IsoDateSchema,
	nextDeliveryAt: IsoDateSchema.nullable(),
	updatedAt: IsoDateSchema,
});
export type FriendScenario = z.infer<typeof FriendScenarioSchema>;

// =============================================================================
// Scenario with Steps (composite)
// =============================================================================

export const ScenarioWithStepsSchema = ScenarioSchema.extend({
	steps: z.array(ScenarioStepSchema),
});
export type ScenarioWithSteps = z.infer<typeof ScenarioWithStepsSchema>;
