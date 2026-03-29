// =============================================================================
// CQRS Shared Types and Authorization Helpers
//
// Provides common Result types for Query Handlers (read-only) and
// Command Handlers (write, domain-event-producing).
// Both use the same underlying repository layer; only the call-site differs.
// =============================================================================

import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import type { StaffContext } from "../rpc/types.js";
import { READ_ROLES, WRITE_ROLES } from "../rpc/types.js";

export type { StaffContext };

// ---------------------------------------------------------------------------
// Unified service error -- used by both queries and commands
// ---------------------------------------------------------------------------

export interface ServiceError {
	readonly code: string;
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Result aliases -- semantically distinct but structurally identical today.
// Separating them allows future divergence (e.g., commands returning events).
// ---------------------------------------------------------------------------

/**
 * QueryResult: returned by query handlers.
 * Queries are read-only; they never produce domain events.
 */
export type QueryResult<T> = Result<T, ServiceError>;

/**
 * CommandResult: returned by command handlers.
 * Commands validate through aggregates and may produce domain events.
 */
export type CommandResult<T> = Result<T, ServiceError>;

// ---------------------------------------------------------------------------
// Authorization helpers -- shared across all query / command handlers
// ---------------------------------------------------------------------------

/**
 * Assert that the staff member has read access.
 * Returns a ServiceError if the role is not in READ_ROLES, or null on success.
 */
export function assertReadAccess(
	staff: StaffContext,
	contextMessage = "Insufficient permissions to read data",
): ServiceError | null {
	if (!(READ_ROLES as readonly string[]).includes(staff.role)) {
		return { code: "FORBIDDEN", message: contextMessage };
	}
	return null;
}

/**
 * Assert that the staff member has write access.
 * Returns a ServiceError if the role is not in WRITE_ROLES, or null on success.
 */
export function assertWriteAccess(
	staff: StaffContext,
	contextMessage = "Insufficient permissions to modify data",
): ServiceError | null {
	if (!(WRITE_ROLES as readonly string[]).includes(staff.role)) {
		return { code: "FORBIDDEN", message: contextMessage };
	}
	return null;
}

// ---------------------------------------------------------------------------
// Result constructor re-exports -- avoid duplicating neverthrow imports
// ---------------------------------------------------------------------------

export { err, ok };

// ---------------------------------------------------------------------------
// Common error codes -- machine-readable constants shared across domains
// ---------------------------------------------------------------------------

export const CommonErrors = {
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	ACCOUNT_SCOPE_REQUIRED: "ACCOUNT_SCOPE_REQUIRED",
	VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;
