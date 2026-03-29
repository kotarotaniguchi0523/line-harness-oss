// =============================================================================
// RPC Utilities - shared helpers for all RPC targets
// =============================================================================

import type { z } from "zod";

/**
 * Format a ZodError into a single human-readable string for RPC error messages.
 */
export function formatZodError(error: z.ZodError): string {
	return `Validation failed: ${error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`;
}

/**
 * Convert a service error (code + message) into a thrown Error for RPC.
 */
export function throwServiceError(error: { code: string; message: string }): never {
	throw new Error(`[${error.code}] ${error.message}`);
}
