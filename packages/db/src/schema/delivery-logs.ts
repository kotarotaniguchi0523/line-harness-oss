// =============================================================================
// Delivery Logs Schema — Per-recipient delivery result tracking
// =============================================================================
// Every message sent via LINE Messaging API is recorded with success/fail status.
// This provides auditing, debugging, and delivery statistics.

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";
import { friends } from "./crm.js";

// --- Delivery Result (per-recipient per-message) ---

export const deliveryLogs = sqliteTable(
	"delivery_logs",
	{
		id: id(),
		/** Source type: 'broadcast' | 'scenario_step' | 'reminder' | 'push' | 'reply' */
		sourceType: text("source_type").notNull(),
		/** Reference ID (broadcast_id, friend_scenario_id, etc.) */
		sourceId: text("source_id").notNull(),
		/** Friend who received the message */
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		/** LINE user ID of the recipient */
		lineUserId: text("line_user_id").notNull(),
		/** LINE account that sent the message */
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),
		/** Message type sent (text, image, flex, etc.) */
		messageType: text("message_type").notNull(),
		/** Delivery status: 'success' | 'failed' | 'rate_limited' | 'blocked' */
		status: text("status").notNull(),
		/** LINE API request ID for tracing */
		lineRequestId: text("line_request_id"),
		/** HTTP status code from LINE API */
		httpStatus: integer("http_status"),
		/** Error message if failed */
		errorMessage: text("error_message"),
		/** Error code from LINE API (e.g., 429, 400) */
		errorCode: text("error_code"),
		/** Retry attempt number (0 = first attempt) */
		retryAttempt: integer("retry_attempt").notNull().default(0),
		/** Delivery latency in milliseconds */
		latencyMs: integer("latency_ms"),
		...timestamps,
	},
	(table) => [
		index("idx_delivery_logs_source").on(table.sourceType, table.sourceId),
		index("idx_delivery_logs_friend").on(table.friendId),
		index("idx_delivery_logs_status").on(table.status),
		index("idx_delivery_logs_created").on(table.createdAt),
		index("idx_delivery_logs_account_status").on(table.lineAccountId, table.status),
	],
);

// --- Delivery Summary (aggregated per broadcast/scenario) ---

export const deliverySummaries = sqliteTable(
	"delivery_summaries",
	{
		id: id(),
		sourceType: text("source_type").notNull(),
		sourceId: text("source_id").notNull(),
		/** Total recipients targeted */
		totalCount: integer("total_count").notNull().default(0),
		/** Successfully delivered */
		successCount: integer("success_count").notNull().default(0),
		/** Failed deliveries */
		failedCount: integer("failed_count").notNull().default(0),
		/** Rate limited (429) — will be retried */
		rateLimitedCount: integer("rate_limited_count").notNull().default(0),
		/** Blocked by user */
		blockedCount: integer("blocked_count").notNull().default(0),
		/** Average latency in ms */
		avgLatencyMs: integer("avg_latency_ms"),
		/** Delivery started at */
		startedAt: text("started_at"),
		/** Delivery completed at */
		completedAt: text("completed_at"),
		...timestamps,
	},
	(table) => [index("idx_delivery_summaries_source").on(table.sourceType, table.sourceId)],
);
