// =============================================================================
// Zod Validation Middleware — thin wrappers around @hono/zod-validator
// Provides project-standard JSON error formatting for all validation targets.
// =============================================================================

import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

/**
 * Format ZodError issues into a { path: messages[] } map.
 * Used by all validator wrappers to return consistent error responses.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
	const details: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const path = issue.path.join(".") || "_root";
		if (!details[path]) details[path] = [];
		details[path].push(issue.message);
	}
	return details;
}

/**
 * Validates request JSON body against a Zod schema.
 * Parsed data is available via `c.req.valid("json")`.
 *
 * Usage:
 * ```ts
 * import { CreateFriendSchema } from '@line-crm/contracts';
 *
 * app.post('/api/friends',
 *   validateJson(CreateFriendSchema),
 *   async (c) => {
 *     const body = c.req.valid("json");
 *     // body is typed as z.infer<typeof CreateFriendSchema>
 *   }
 * );
 * ```
 */
export function validateJson<T extends z.ZodTypeAny>(schema: T) {
	return zValidator("json", schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					success: false,
					error: "Validation failed",
					details: formatZodErrors(result.error),
				},
				400,
			);
		}
	});
}

/**
 * Validates query parameters against a Zod schema.
 * Parsed data is available via `c.req.valid("query")`.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
	return zValidator("query", schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					success: false,
					error: "Invalid query parameters",
					details: formatZodErrors(result.error),
				},
				400,
			);
		}
	});
}

/**
 * Validates path parameters against a Zod schema.
 * Parsed data is available via `c.req.valid("param")`.
 *
 * Usage:
 * ```ts
 * app.get('/api/friends/:id',
 *   validateParam(z.object({ id: UuidSchema })),
 *   async (c) => {
 *     const { id } = c.req.valid("param");
 *   }
 * );
 * ```
 */
export function validateParam<T extends z.ZodTypeAny>(schema: T) {
	return zValidator("param", schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					success: false,
					error: "Invalid path parameter",
					details: formatZodErrors(result.error),
				},
				400,
			);
		}
	});
}

// Legacy aliases for backward compatibility with existing middleware tests.
// New code should use validateJson / validateQuery / validateParam.
export const validateBody = validateJson;
