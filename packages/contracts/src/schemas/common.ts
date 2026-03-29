import { z } from "zod";

// =============================================================================
// Common Schemas (reusable across all domain schemas)
// =============================================================================

export const UuidSchema = z.string().uuid();
export const IsoDateSchema = z
	.string()
	.datetime({ offset: true })
	.or(z.string().datetime({ offset: false }));
export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const PaginationInputSchema = z.object({
	page: z.number().int().positive().default(1),
	limit: z.number().int().positive().max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationInputSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
	z.object({
		items: z.array(itemSchema),
		total: z.number().int().nonnegative(),
		page: z.number().int().positive(),
		limit: z.number().int().positive(),
		hasNextPage: z.boolean(),
	});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.discriminatedUnion("success", [
		z.object({ success: z.literal(true), data: dataSchema }),
		z.object({
			success: z.literal(false),
			error: z.string(),
			details: z.record(z.array(z.string())).optional(),
		}),
	]);
