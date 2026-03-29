import { z } from "zod";

// =============================================================================
// LINE Messaging API - Audience, Narrowcast, Delivery schemas (Zod validated)
// =============================================================================

// ---------------------------------------------------------------------------
// Demographic filter -- used by narrowcast to target by user attributes
// ---------------------------------------------------------------------------

export const DemographicConditionSchema = z.object({
	type: z.enum(["gender", "age", "appType", "area", "subscriptionPeriod"]),
	oneOf: z.array(z.string()).optional(),
	gte: z.string().optional(),
	lt: z.string().optional(),
});
export type DemographicCondition = z.infer<typeof DemographicConditionSchema>;

export const DemographicFilterSchema: z.ZodType<DemographicFilter> = z.object({
	type: z.literal("operator"),
	and: z.array(DemographicConditionSchema).optional(),
	or: z.array(DemographicConditionSchema).optional(),
	not: DemographicConditionSchema.optional(),
});
export interface DemographicFilter {
	type: "operator";
	and?: DemographicCondition[];
	or?: DemographicCondition[];
	not?: DemographicCondition;
}

// ---------------------------------------------------------------------------
// Audience target -- reference to an audience group by ID
// ---------------------------------------------------------------------------

export const AudienceTargetSchema = z.object({
	type: z.literal("audience"),
	audienceGroupId: z.number().int(),
});
export type AudienceTarget = z.infer<typeof AudienceTargetSchema>;

export const NarrowcastRecipientSchema: z.ZodType<NarrowcastRecipient> = z.object({
	type: z.literal("operator"),
	and: z.array(AudienceTargetSchema).optional(),
	or: z.array(AudienceTargetSchema).optional(),
	not: AudienceTargetSchema.optional(),
});
export interface NarrowcastRecipient {
	type: "operator";
	and?: AudienceTarget[];
	or?: AudienceTarget[];
	not?: AudienceTarget;
}

// ---------------------------------------------------------------------------
// Narrowcast request -- POST /v2/bot/message/narrowcast
// ---------------------------------------------------------------------------

export const NarrowcastLimitSchema = z.object({
	max: z.number().int().min(1),
	upToRemainingQuota: z.boolean().optional(),
});

export const NarrowcastRequestSchema = z.object({
	messages: z.array(z.record(z.unknown())).min(1).max(5),
	recipient: NarrowcastRecipientSchema.optional(),
	demographic: DemographicFilterSchema.optional(),
	limit: NarrowcastLimitSchema.optional(),
});

// ---------------------------------------------------------------------------
// Audience group -- response from audience management endpoints
// ---------------------------------------------------------------------------

export const AudienceGroupSchema = z.object({
	audienceGroupId: z.number().int(),
	createRoute: z.string().optional(),
	type: z.string(),
	description: z.string(),
	status: z.string(),
	audienceCount: z.number().int().optional(),
	created: z.number().optional(),
	isIfaAudience: z.boolean().optional(),
	permission: z.string().optional(),
	expireTimestamp: z.number().optional(),
	requestId: z.string().optional(),
	clickUrl: z.string().optional(),
	jobs: z.array(z.record(z.unknown())).optional(),
});
export type AudienceGroup = z.infer<typeof AudienceGroupSchema>;

// ---------------------------------------------------------------------------
// Audience management request schemas
// ---------------------------------------------------------------------------

export const CreateUploadAudienceRequestSchema = z.object({
	description: z.string().min(1).max(120),
	audiences: z.array(z.object({ id: z.string().min(1) })).min(1),
});

export const AddToUploadAudienceRequestSchema = z.object({
	audienceGroupId: z.number().int(),
	audiences: z.array(z.object({ id: z.string().min(1) })).min(1),
});

export const CreateClickAudienceRequestSchema = z.object({
	description: z.string().min(1).max(120),
	requestId: z.string().min(1),
	clickUrl: z.string().optional(),
});

export const CreateImpressionAudienceRequestSchema = z.object({
	description: z.string().min(1).max(120),
	requestId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Audience management response schemas
// ---------------------------------------------------------------------------

export const CreateAudienceResponseSchema = z.object({
	audienceGroupId: z.number().int(),
	created: z.string(),
});
export type CreateAudienceResponse = z.infer<typeof CreateAudienceResponseSchema>;

export const GetAudienceResponseSchema = z.object({
	audienceGroup: AudienceGroupSchema,
	jobs: z.array(z.record(z.unknown())).optional(),
});

export const ListAudiencesResponseSchema = z.object({
	audienceGroups: z.array(AudienceGroupSchema),
	totalCount: z.number().int(),
	page: z.number().int().optional(),
	size: z.number().int().optional(),
});
export type ListAudiencesResponse = z.infer<typeof ListAudiencesResponseSchema>;

// ---------------------------------------------------------------------------
// Delivery result -- GET /v2/bot/message/delivery/{type}
// ---------------------------------------------------------------------------

export const DeliveryResultSchema = z.object({
	status: z.enum(["ready", "unready", "not_applicable"]),
	success: z.number().int().optional(),
	failure: z.number().int().optional(),
	rate_limited: z.number().int().optional(),
});
export type DeliveryResult = z.infer<typeof DeliveryResultSchema>;
