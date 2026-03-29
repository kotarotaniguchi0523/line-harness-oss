import { z } from "zod";
import { UuidSchema } from "./common.js";

// =============================================================================
// Tracked Link — Request Schemas
// =============================================================================

/**
 * Schema for creating a new tracked link.
 * Used by POST /api/tracked-links
 */
export const CreateTrackedLinkSchema = z.object({
	name: z.string().min(1),
	originalUrl: z.string().url(),
	tagId: z.string().uuid().nullable().optional(),
	scenarioId: z.string().uuid().nullable().optional(),
});
export type CreateTrackedLinkRequest = z.infer<typeof CreateTrackedLinkSchema>;

// =============================================================================
// Tracked Link — Entity Schemas (read models)
// =============================================================================

/**
 * Full tracked link entity schema for API responses.
 */
export const TrackedLinkSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	originalUrl: z.string().url(),
	trackingUrl: z.string().url().optional(),
	tagId: UuidSchema.nullable(),
	scenarioId: UuidSchema.nullable(),
	isActive: z.boolean(),
	clickCount: z.number().int().nonnegative(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type TrackedLink = z.infer<typeof TrackedLinkSchema>;

/**
 * Tracked link click record schema.
 */
export const TrackedLinkClickSchema = z.object({
	id: UuidSchema,
	friendId: UuidSchema.nullable(),
	friendDisplayName: z.string().nullable().optional(),
	clickedAt: z.string(),
});
export type TrackedLinkClick = z.infer<typeof TrackedLinkClickSchema>;

/**
 * Tracked link with click details (composite read model).
 */
export const TrackedLinkWithClicksSchema = TrackedLinkSchema.extend({
	clicks: z.array(TrackedLinkClickSchema),
});
export type TrackedLinkWithClicks = z.infer<typeof TrackedLinkWithClicksSchema>;

// =============================================================================
// Tracked Link — Query Schemas (for route query params)
// =============================================================================

/**
 * Schema for tracked link click-tracking redirect query parameters.
 * Used by GET /t/:linkId (public redirect endpoint)
 */
export const TrackedLinkRedirectQuerySchema = z.object({
	/** LINE user ID passed via query param 'lu' */
	lu: z.string().optional(),
	/** Friend ID passed via query param 'f' */
	f: z.string().uuid().optional(),
});
export type TrackedLinkRedirectQuery = z.infer<typeof TrackedLinkRedirectQuerySchema>;
