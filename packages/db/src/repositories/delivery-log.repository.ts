// =============================================================================
// Delivery Log Repository — Per-recipient delivery result tracking
// =============================================================================
// Records every LINE API message send attempt with status, latency, error info.
// Provides delivery summaries aggregated by source (broadcast, scenario, etc.).

import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { deliveryLogs, deliverySummaries } from "../schema/delivery-logs.js";
import { DateTime } from "../utils.js";

// --- Types ---

interface DeliveryLogEntry {
	readonly sourceType: string;
	readonly sourceId: string;
	readonly friendId: string;
	readonly lineUserId: string;
	readonly lineAccountId?: string;
	readonly messageType: string;
	readonly status: "success" | "failed" | "rate_limited" | "blocked";
	readonly lineRequestId?: string;
	readonly httpStatus?: number;
	readonly errorMessage?: string;
	readonly errorCode?: string;
	readonly retryAttempt?: number;
	readonly latencyMs?: number;
}

interface DeliveryBatchResult {
	readonly totalInserted: number;
	readonly summaryUpdated: boolean;
}

// --- Repository Factory ---

export function createDeliveryLogRepository(db: Database) {
	return {
		/**
		 * Record a single delivery result.
		 */
		async record(entry: DeliveryLogEntry): Promise<void> {
			await db.insert(deliveryLogs).values({
				sourceType: entry.sourceType,
				sourceId: entry.sourceId,
				friendId: entry.friendId,
				lineUserId: entry.lineUserId,
				lineAccountId: entry.lineAccountId ?? null,
				messageType: entry.messageType,
				status: entry.status,
				lineRequestId: entry.lineRequestId ?? null,
				httpStatus: entry.httpStatus ?? null,
				errorMessage: entry.errorMessage ?? null,
				errorCode: entry.errorCode ?? null,
				retryAttempt: entry.retryAttempt ?? 0,
				latencyMs: entry.latencyMs ?? null,
			});
		},

		/**
		 * Record a batch of delivery results and update the summary atomically.
		 */
		async recordBatch(entries: readonly DeliveryLogEntry[]): Promise<DeliveryBatchResult> {
			if (entries.length === 0) return { totalInserted: 0, summaryUpdated: false };

			// Insert all log entries
			await db.insert(deliveryLogs).values(
				entries.map((e) => ({
					sourceType: e.sourceType,
					sourceId: e.sourceId,
					friendId: e.friendId,
					lineUserId: e.lineUserId,
					lineAccountId: e.lineAccountId ?? null,
					messageType: e.messageType,
					status: e.status,
					lineRequestId: e.lineRequestId ?? null,
					httpStatus: e.httpStatus ?? null,
					errorMessage: e.errorMessage ?? null,
					errorCode: e.errorCode ?? null,
					retryAttempt: e.retryAttempt ?? 0,
					latencyMs: e.latencyMs ?? null,
				})),
			);

			// Update or create delivery summary
			const sourceType = entries[0].sourceType;
			const sourceId = entries[0].sourceId;
			const successCount = entries.filter((e) => e.status === "success").length;
			const failedCount = entries.filter((e) => e.status === "failed").length;
			const rateLimitedCount = entries.filter((e) => e.status === "rate_limited").length;
			const blockedCount = entries.filter((e) => e.status === "blocked").length;
			const avgLatency = entries.reduce((sum, e) => sum + (e.latencyMs ?? 0), 0) / entries.length;

			await db
				.insert(deliverySummaries)
				.values({
					sourceType,
					sourceId,
					totalCount: entries.length,
					successCount,
					failedCount,
					rateLimitedCount,
					blockedCount,
					avgLatencyMs: Math.round(avgLatency),
					startedAt: DateTime.now().toISO(),
				})
				.onConflictDoUpdate({
					target: deliverySummaries.id,
					set: {
						totalCount: sql`${deliverySummaries.totalCount} + ${entries.length}`,
						successCount: sql`${deliverySummaries.successCount} + ${successCount}`,
						failedCount: sql`${deliverySummaries.failedCount} + ${failedCount}`,
						rateLimitedCount: sql`${deliverySummaries.rateLimitedCount} + ${rateLimitedCount}`,
						blockedCount: sql`${deliverySummaries.blockedCount} + ${blockedCount}`,
						completedAt: DateTime.now().toISO(),
					},
				});

			return { totalInserted: entries.length, summaryUpdated: true };
		},

		/**
		 * Get delivery logs for a specific source (broadcast, scenario step, etc.).
		 */
		async getBySource(
			sourceType: string,
			sourceId: string,
			opts?: {
				status?: string;
				limit?: number;
				offset?: number;
			},
		) {
			const conditions = [eq(deliveryLogs.sourceType, sourceType), eq(deliveryLogs.sourceId, sourceId)];
			if (opts?.status) {
				conditions.push(eq(deliveryLogs.status, opts.status));
			}

			const rows = await db
				.select()
				.from(deliveryLogs)
				.where(and(...conditions))
				.orderBy(desc(deliveryLogs.createdAt))
				.limit(opts?.limit ?? 100)
				.offset(opts?.offset ?? 0);

			return rows;
		},

		/**
		 * Get delivery summary for a source.
		 */
		async getSummary(sourceType: string, sourceId: string) {
			const [row] = await db
				.select()
				.from(deliverySummaries)
				.where(and(eq(deliverySummaries.sourceType, sourceType), eq(deliverySummaries.sourceId, sourceId)));
			return row ?? null;
		},

		/**
		 * Get failed deliveries for retry processing.
		 */
		async getFailedForRetry(opts: { sourceType?: string; maxRetryAttempt?: number; limit?: number }) {
			const conditions = [eq(deliveryLogs.status, "failed")];
			if (opts.sourceType) {
				conditions.push(eq(deliveryLogs.sourceType, opts.sourceType));
			}
			if (opts.maxRetryAttempt !== undefined) {
				conditions.push(sql`${deliveryLogs.retryAttempt} < ${opts.maxRetryAttempt}`);
			}

			return db
				.select()
				.from(deliveryLogs)
				.where(and(...conditions))
				.orderBy(deliveryLogs.createdAt)
				.limit(opts.limit ?? 100);
		},

		/**
		 * Get delivery statistics for a date range (for dashboard).
		 */
		async getStats(lineAccountId: string, days: number = 7) {
			const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

			const [stats] = await db
				.select({
					total: sql<number>`COUNT(*)`,
					success: sql<number>`SUM(CASE WHEN ${deliveryLogs.status} = 'success' THEN 1 ELSE 0 END)`,
					failed: sql<number>`SUM(CASE WHEN ${deliveryLogs.status} = 'failed' THEN 1 ELSE 0 END)`,
					rateLimited: sql<number>`SUM(CASE WHEN ${deliveryLogs.status} = 'rate_limited' THEN 1 ELSE 0 END)`,
					avgLatency: sql<number>`AVG(${deliveryLogs.latencyMs})`,
				})
				.from(deliveryLogs)
				.where(and(eq(deliveryLogs.lineAccountId, lineAccountId), sql`${deliveryLogs.createdAt} >= ${since}`));

			return stats;
		},
	};
}
