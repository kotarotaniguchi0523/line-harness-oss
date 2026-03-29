// =============================================================================
// Background Job Schema — Persistent retry table for jobs that need
// observability beyond the Cloudflare Queue's built-in retry mechanism.
//
// The CF Queue handles primary retry logic (max_retries in wrangler.toml).
// This table captures failed jobs for:
//   - Observability dashboards (which jobs fail, how often, what errors)
//   - Manual retry from admin UI
//   - Dead letter analysis (jobs that exhausted Queue retries)
//   - Audit trail of job execution history
// =============================================================================

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "./_common.js";

// =============================================================================
// job_retries — Failed/retryable jobs persisted to D1
// =============================================================================

/**
 * Stores jobs that failed during Queue processing, either for automatic retry
 * (via cron) or manual retry (via admin dashboard). When a job exhausts its
 * Queue-level retries and lands in the DLQ, a copy is also persisted here
 * with status='failed' for post-mortem analysis.
 *
 * Status transitions:
 *   pending -> processing -> completed
 *                         -> failed (if attempts >= maxAttempts)
 *   pending -> processing -> pending (if attempts < maxAttempts, retry scheduled)
 */
export const jobRetries = sqliteTable(
	"job_retries",
	{
		id: id(),

		/** Discriminated job type (matches the Job union in job-queue.service.ts) */
		jobType: text("job_type").notNull(),

		/** Full job payload serialized as JSON (can be deserialized back to Job type) */
		payload: text("payload").notNull(),

		/**
		 * Current status of the retry record:
		 * - pending:    Awaiting next retry attempt
		 * - processing: Currently being processed by cron or manual trigger
		 * - completed:  Successfully processed after retry
		 * - failed:     Exhausted all retry attempts
		 */
		status: text("status").notNull().default("pending"),

		/** Number of attempts made so far (incremented on each retry) */
		attempts: integer("attempts").notNull().default(0),

		/** Maximum number of retry attempts before marking as permanently failed */
		maxAttempts: integer("max_attempts").notNull().default(3),

		/** Error message from the most recent failed attempt */
		lastError: text("last_error"),

		/** ISO 8601 timestamp of when the next retry should be attempted */
		nextRetryAt: text("next_retry_at"),

		/** ISO 8601 timestamp columns (created_at, updated_at) */
		...timestamps,
	},
	(table) => [
		// Query patterns:
		// 1. Cron job picks up pending retries ordered by next_retry_at
		index("idx_job_retries_status_next").on(table.status, table.nextRetryAt),

		// 2. Dashboard: filter by job type for observability
		index("idx_job_retries_type").on(table.jobType),

		// 3. Cleanup: find old completed/failed jobs by created_at
		index("idx_job_retries_created").on(table.createdAt),
	],
);

// =============================================================================
// job_execution_logs — Audit trail for all job executions (success and failure)
// =============================================================================

/**
 * Immutable log of every job execution attempt. Unlike job_retries (which is
 * mutable and tracks the current state of a retryable job), this table is
 * append-only and records each individual attempt for audit/debugging.
 *
 * Useful for:
 *   - "How many times did broadcast X retry before succeeding?"
 *   - "What was the error on attempt 2 of step delivery Y?"
 *   - Time-series analysis of job throughput and failure rates
 */
export const jobExecutionLogs = sqliteTable(
	"job_execution_logs",
	{
		id: id(),

		/** Foreign key to job_retries.id (nullable — not all executions come from retries) */
		jobRetryId: text("job_retry_id").references(() => jobRetries.id),

		/** Discriminated job type */
		jobType: text("job_type").notNull(),

		/** Outcome of this execution attempt */
		status: text("status").notNull(), // 'completed' | 'failed'

		/** Duration of this execution in milliseconds */
		durationMs: integer("duration_ms"),

		/** Error message if the execution failed */
		errorMessage: text("error_message"),

		/** Serialized job payload at the time of execution */
		payload: text("payload"),

		/** ISO 8601 timestamp of when this execution started */
		executedAt: text("executed_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		// Dashboard: job execution history filtered by type
		index("idx_job_exec_logs_type").on(table.jobType),

		// Dashboard: filter by status (e.g. show all failures)
		index("idx_job_exec_logs_status").on(table.status),

		// Time-series queries: job throughput over time
		index("idx_job_exec_logs_executed").on(table.executedAt),

		// Link back to the retry record for detailed retry history
		index("idx_job_exec_logs_retry").on(table.jobRetryId),
	],
);
