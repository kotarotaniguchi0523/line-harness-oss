// =============================================================================
// Result<T, E> -- neverthrow-based deterministic error handling (no exceptions)
//
// Re-exports neverthrow as the single Result implementation for the domain layer.
// Provides domain-specific error types and helper constructors so that aggregates
// and domain services can produce structured, machine-readable errors without
// resorting to thrown exceptions or bare strings.
// =============================================================================

import {
	err,
	errAsync,
	fromPromise,
	fromSafePromise,
	fromThrowable,
	ok,
	okAsync,
	type Result,
	type ResultAsync,
} from "neverthrow";

// ---------------------------------------------------------------------------
// Re-exports -- consumers import everything from this module, never directly
// from "neverthrow", keeping the dependency boundary in one place.
// ---------------------------------------------------------------------------

export type { Result, ResultAsync };
export { err, errAsync, fromPromise, fromSafePromise, fromThrowable, ok, okAsync };

// ---------------------------------------------------------------------------
// Common error code constants (no hardcoded magic strings)
// ---------------------------------------------------------------------------

export const ErrorCodes = {
	/** Requested entity was not found */
	NOT_FOUND: "NOT_FOUND",
	/** Input failed business-rule or schema validation */
	VALIDATION_FAILED: "VALIDATION_FAILED",
	/** Entity with the same identity already exists */
	ALREADY_EXISTS: "ALREADY_EXISTS",
	/** Caller is not authenticated */
	UNAUTHORIZED: "UNAUTHORIZED",
	/** Caller lacks required permissions */
	FORBIDDEN: "FORBIDDEN",
	/** Domain invariant was violated */
	INVARIANT_VIOLATED: "INVARIANT_VIOLATED",
	/** Requested state transition is not allowed */
	INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
	/** Tag or association not found on target entity */
	NOT_ASSIGNED: "NOT_ASSIGNED",
	/** Duplicate step order or conflicting ordinal */
	DUPLICATE_ORDER: "DUPLICATE_ORDER",
	/** Step or sub-entity not found by ordinal key */
	STEP_NOT_FOUND: "STEP_NOT_FOUND",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ---------------------------------------------------------------------------
// DomainError -- structured error value carried inside Result<T, DomainError>
// ---------------------------------------------------------------------------

export interface DomainError {
	/** Machine-readable error code from ErrorCodes */
	readonly code: ErrorCode;
	/** Human-readable description (for logs / dev, NOT shown to end-users) */
	readonly message: string;
	/** Optional bag of contextual data useful for debugging */
	readonly context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// domainError -- concise factory so aggregate code stays compact
// ---------------------------------------------------------------------------

/**
 * Create a DomainError value.
 *
 * @example
 * ```ts
 * return err(domainError(ErrorCodes.NOT_FOUND, ErrorMessages.TAG_NOT_ASSIGNED, { tagId }));
 * ```
 */
export function domainError(code: ErrorCode, message: string, context?: Record<string, unknown>): DomainError {
	return Object.freeze({ code, message, ...(context ? { context } : {}) });
}

// ---------------------------------------------------------------------------
// Error message constants -- aggregates reference these instead of literals
// ---------------------------------------------------------------------------

export const ErrorMessages = {
	TAG_NOT_ASSIGNED: "Tag is not assigned to this friend",
	STEP_ORDER_ALREADY_EXISTS: "A step with this order already exists in the scenario",
	STEP_ORDER_NOT_FOUND: "No step found with the specified order in the scenario",
	CANNOT_SCHEDULE_BROADCAST: "Cannot schedule broadcast from current status",
	CANNOT_SEND_BROADCAST: "Cannot start sending broadcast from current status",
} as const;
