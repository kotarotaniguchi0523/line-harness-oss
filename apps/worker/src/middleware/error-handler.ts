// =============================================================================
// Global Error Handler Middleware
// Catches HTTPException and unhandled errors with structured responses
// Integrates with Sentry for error tracking
// =============================================================================

import { captureException } from "@sentry/cloudflare";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodError } from "zod";
import { formatZodErrors } from "./validate.js";

/**
 * Converts errors to structured JSON responses.
 * - HTTPException → status code from exception
 * - ZodError → 400 with validation details
 * - Unknown → 500 with generic message + Sentry report
 */
export const errorHandler: ErrorHandler = (err, c) => {
	const requestId = c.get("requestId" as never) ?? "unknown";

	// Hono HTTPException (thrown by middleware/routes)
	if (err instanceof HTTPException) {
		if (err.status >= 500) {
			captureException(err);
		}
		return c.json({ success: false, error: err.message, requestId }, err.status);
	}

	// Zod validation error (thrown by schema.parse())
	if ("issues" in err && Array.isArray((err as ZodError).issues)) {
		const details = formatZodErrors(err as ZodError);
		return c.json({ success: false, error: "Validation failed", details, requestId }, 400);
	}

	// Unhandled error → always report to Sentry
	captureException(err);
	console.error(`[${requestId}] Unhandled error:`, err);
	return c.json({ success: false, error: "Internal server error", requestId }, 500);
};
