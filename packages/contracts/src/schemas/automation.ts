import { z } from "zod";
import { AutomationActionType, AutomationEventType, AutomationLogStatus } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

export const AutomationActionSchema = z.object({
	type: AutomationActionType,
	params: z.record(z.unknown()),
});
export type AutomationAction = z.infer<typeof AutomationActionSchema>;

export const AutomationConditionsSchema = z
	.object({
		scoreThreshold: z.number().int().optional(),
		tagId: UuidSchema.optional(),
		keyword: z.string().optional(),
	})
	.passthrough();
export type AutomationConditions = z.infer<typeof AutomationConditionsSchema>;

export const AutomationSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	description: z.string().nullable(),
	eventType: AutomationEventType,
	conditions: AutomationConditionsSchema,
	actions: z.array(AutomationActionSchema),
	isActive: z.boolean(),
	priority: z.number().int().default(0),
	lineAccountId: UuidSchema.nullable(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type Automation = z.infer<typeof AutomationSchema>;

export const CreateAutomationSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	eventType: AutomationEventType,
	conditions: AutomationConditionsSchema.optional(),
	actions: z.array(AutomationActionSchema),
	priority: z.number().int().optional(),
	lineAccountId: UuidSchema.optional(),
});
export type CreateAutomation = z.infer<typeof CreateAutomationSchema>;

export const AutomationLogSchema = z.object({
	id: UuidSchema,
	automationId: UuidSchema,
	friendId: UuidSchema.nullable(),
	eventData: z.string().nullable(),
	actionsResult: z.string().nullable(),
	status: AutomationLogStatus,
	createdAt: IsoDateSchema,
});
export type AutomationLog = z.infer<typeof AutomationLogSchema>;
