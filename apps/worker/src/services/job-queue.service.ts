// =============================================================================
// Background Job Queue Service
// Enqueues jobs via Cloudflare Queues with waitUntil, and processes them
// in the queue consumer handler. Failed jobs fall back to D1 retry table.
// =============================================================================

import { JOB_QUEUE_CONFIG } from "@line-crm/contracts";
import { createDb, createLineAccountRepository, DateTime } from "@line-crm/db";
import { jobRetries } from "@line-crm/db/schema";
import { LineClient } from "@line-crm/line-sdk";
import type { Env } from "../index.js";
import { sendAdConversions } from "./ad-conversion.js";
import { processScheduledBroadcasts } from "./broadcast.js";
import { processStepDeliveries } from "./step-delivery.js";

// =============================================================================
// Job Type Definitions (discriminated union)
// =============================================================================

interface SendBroadcastJob {
	type: "send_broadcast";
	broadcastId: string;
	lineAccountId: string | null;
}

interface DeliverStepJob {
	type: "deliver_step";
	friendScenarioId: string;
	stepOrder: number;
	lineAccountId: string | null;
}

interface FireConversionJob {
	type: "fire_conversion";
	eventId: string;
	friendId: string;
	platform: string;
	eventName: string;
	conversionValue?: number;
}

interface SyncWebhookJob {
	type: "sync_webhook";
	webhookId: string;
	payload: string;
	targetUrl: string;
	secret: string | null;
}

export type Job = SendBroadcastJob | DeliverStepJob | FireConversionJob | SyncWebhookJob;

// =============================================================================
// Enqueue — Non-blocking via ExecutionContext.waitUntil + Queue.send
// =============================================================================

/**
 * Enqueue a background job into Cloudflare Queues.
 * Uses waitUntil so the caller (e.g. webhook handler) is not blocked.
 * Optionally deduplicates via KV to prevent double-enqueue within a window.
 */
export function enqueueJob(
	ctx: ExecutionContext,
	queue: Queue,
	job: Job,
	options?: { cache?: KVNamespace; dedupKey?: string },
): void {
	const sendPromise = (async () => {
		// Dedup guard: skip if the same job was recently enqueued
		if (options?.cache && options.dedupKey) {
			const existing = await options.cache.get(options.dedupKey);
			if (existing) {
				console.log(`[JobQueue] Skipping duplicate job: ${options.dedupKey}`);
				return;
			}
			await options.cache.put(options.dedupKey, DateTime.now().toISO(), {
				expirationTtl: JOB_QUEUE_CONFIG.dedupTtlSeconds,
			});
		}

		await queue.send(job);
		console.log(`[JobQueue] Enqueued ${job.type}`);
	})();

	ctx.waitUntil(sendPromise);
}

/**
 * Enqueue multiple jobs as a batch (Cloudflare Queues supports batch send).
 * Each job is sent individually wrapped in waitUntil for non-blocking behavior.
 */
export function enqueueJobBatch(ctx: ExecutionContext, queue: Queue, jobs: Job[]): void {
	const batchPromise = (async () => {
		const sendPromises = jobs.map((job) => queue.send(job));
		const results = await Promise.allSettled(sendPromises);
		const failedCount = results.filter((r) => r.status === "rejected").length;
		if (failedCount > 0) {
			console.error(`[JobQueue] Failed to enqueue ${failedCount}/${jobs.length} jobs`);
		} else {
			console.log(`[JobQueue] Batch enqueued ${jobs.length} jobs`);
		}
	})();

	ctx.waitUntil(batchPromise);
}

// =============================================================================
// Consumer — Process jobs from the queue
// =============================================================================

/**
 * Process a batch of jobs received from the Cloudflare Queue consumer.
 * Each message is acked on success, retried on failure (up to max_retries
 * configured in wrangler.toml, then routed to the dead letter queue).
 */
export async function processJobBatch(batch: MessageBatch, env: Env["Bindings"]): Promise<void> {
	console.log(`[JobQueue] Processing batch of ${batch.messages.length} messages`);

	for (const msg of batch.messages) {
		const job = msg.body as Job;
		const startTime = Date.now();

		try {
			await dispatchJob(job, env);
			msg.ack();

			const duration = Date.now() - startTime;
			console.log(`[JobQueue] Completed ${job.type} in ${duration}ms`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[JobQueue] Failed ${job.type}: ${errorMessage}`);

			// Persist failure to D1 retry table for observability
			await persistJobFailure(env.DB, job, errorMessage).catch((dbErr) =>
				console.error("[JobQueue] Failed to persist job failure:", dbErr),
			);

			msg.retry();
		}
	}
}

// =============================================================================
// Job Dispatch — Route each job type to its handler
// =============================================================================

async function dispatchJob(job: Job, env: Env["Bindings"]): Promise<void> {
	switch (job.type) {
		case "send_broadcast":
			await handleSendBroadcast(env, job);
			break;
		case "deliver_step":
			await handleDeliverStep(env, job);
			break;
		case "fire_conversion":
			await handleFireConversion(env, job);
			break;
		case "sync_webhook":
			await handleSyncWebhook(env, job);
			break;
		default: {
			// Exhaustive check: if we reach here, a new job type was added without a handler
			const _exhaustive: never = job;
			throw new Error(`Unknown job type: ${(job as Job).type}`);
		}
	}
}

// =============================================================================
// Individual Job Handlers
// =============================================================================

/**
 * Send a scheduled broadcast to its target audience.
 * Resolves the LINE account credentials and delegates to the broadcast service.
 */
async function handleSendBroadcast(env: Env["Bindings"], job: SendBroadcastJob): Promise<void> {
	const { accessToken, workerUrl } = await resolveLineCredentials(env, job.lineAccountId);
	const lineClient = new LineClient(accessToken);
	await processScheduledBroadcasts(env.DB, lineClient, workerUrl);
}

/**
 * Deliver a single step in a scenario to a specific friend.
 * Resolves credentials and delegates to the step delivery service.
 */
async function handleDeliverStep(env: Env["Bindings"], job: DeliverStepJob): Promise<void> {
	const { accessToken, workerUrl } = await resolveLineCredentials(env, job.lineAccountId);
	const lineClient = new LineClient(accessToken);
	await processStepDeliveries(env.DB, lineClient, workerUrl);
}

/**
 * Fire a conversion event to ad platforms (Meta CAPI, Google Ads, etc.).
 * Sends the conversion data for attribution tracking.
 */
async function handleFireConversion(env: Env["Bindings"], job: FireConversionJob): Promise<void> {
	await sendAdConversions(env.DB, job.friendId, job.eventName, job.conversionValue);
}

/**
 * Sync an outgoing webhook — POST payload to the target URL with HMAC signature.
 */
async function handleSyncWebhook(_env: Env["Bindings"], job: SyncWebhookJob): Promise<void> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };

	// HMAC signature if secret is provided
	if (job.secret) {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(job.secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(job.payload));
		const hexSignature = Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		headers["X-Webhook-Signature"] = hexSignature;
	}

	const response = await fetch(job.targetUrl, {
		method: "POST",
		headers,
		body: job.payload,
	});

	if (!response.ok) {
		throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
	}
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve LINE API credentials for a given account.
 * Falls back to environment variables if no account ID is provided or account not found.
 */
async function resolveLineCredentials(
	env: Env["Bindings"],
	lineAccountId: string | null,
): Promise<{ accessToken: string; workerUrl: string }> {
	if (lineAccountId) {
		const drizzle = createDb(env.DB);
		const accountRepo = createLineAccountRepository(drizzle);
		const accounts = await accountRepo.list();
		const account = accounts.find((a) => a.id === lineAccountId && a.isActive);
		if (account) {
			return {
				accessToken: account.channelAccessToken,
				workerUrl: env.WORKER_URL,
			};
		}
	}

	return {
		accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
		workerUrl: env.WORKER_URL,
	};
}

/**
 * Persist a job failure to the D1 job_retries table for observability and manual retry.
 * This is a best-effort write — the Queue's own retry mechanism is the primary safety net.
 */
async function persistJobFailure(db: D1Database, job: Job, errorMessage: string): Promise<void> {
	const _now = DateTime.now().toISO();
	const nextRetryAt = calculateNextRetryTime(1);
	const drizzle = createDb(db);

	await drizzle.insert(jobRetries).values({
		id: crypto.randomUUID(),
		jobType: job.type,
		payload: JSON.stringify(job),
		status: "failed",
		attempts: 1,
		maxAttempts: JOB_QUEUE_CONFIG.defaultMaxAttempts,
		lastError: errorMessage,
		nextRetryAt,
	});
}

/**
 * Calculate the next retry time using exponential backoff with jitter.
 * Formula: min(base * 2^attempt + random_jitter, maxDelay)
 */
function calculateNextRetryTime(attempt: number): string {
	const baseDelay = JOB_QUEUE_CONFIG.retryBaseDelayMs;
	const maxDelay = JOB_QUEUE_CONFIG.retryMaxDelayMs;
	const exponentialDelay = Math.min(baseDelay * 2 ** attempt, maxDelay);
	// Add jitter: 0-25% of the delay
	const jitter = Math.random() * exponentialDelay * 0.25;
	const totalDelay = exponentialDelay + jitter;

	const retryDate = new Date(Date.now() + totalDelay);
	return retryDate.toISOString();
}
