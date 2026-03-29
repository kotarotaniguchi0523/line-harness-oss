// =============================================================================
// Background Context Middleware
// Captures ExecutionContext and Queue binding for use in route handlers.
// Enables non-blocking background work via waitUntil without blocking responses.
// =============================================================================

import type { Context } from "hono";
import { createTypedMiddleware } from "../factory.js";

// Augment Hono's ContextVariableMap so `c.get('executionCtx')` and
// `c.get('jobQueue')` are strongly typed throughout the application.
declare module "hono" {
	interface ContextVariableMap {
		executionCtx: ExecutionContext;
		jobQueue: Queue | null;
		kvCache: KVNamespace | null;
	}
}

/**
 * Middleware that injects the Cloudflare Workers ExecutionContext, Queue, and
 * KV bindings into Hono's context variable map.
 *
 * Usage in route handlers:
 * ```ts
 * app.post('/api/example', async (c) => {
 *   const ctx = c.get('executionCtx');
 *   const queue = c.get('jobQueue');
 *   // Enqueue a background job without blocking the response
 *   if (queue) {
 *     ctx.waitUntil(queue.send({ type: 'example', data: '...' }));
 *   }
 *   return c.json({ success: true });
 * });
 * ```
 */
export const backgroundContextMiddleware = createTypedMiddleware(async (c, next) => {
	// executionCtx is available on the Hono context directly (Cloudflare Workers runtime)
	c.set("executionCtx", c.executionCtx);

	// Queue and KV may not be bound in all environments (e.g. local dev without miniflare)
	// Gracefully degrade to null so callers can check before using
	const queue = (c.env as Record<string, unknown>).JOB_QUEUE as Queue | undefined;
	c.set("jobQueue", queue ?? null);

	const cache = (c.env as Record<string, unknown>).CACHE as KVNamespace | undefined;
	c.set("kvCache", cache ?? null);

	await next();
});

// =============================================================================
// Helper: Run arbitrary async work in the background via waitUntil
// =============================================================================

/**
 * Run an async function in the background without blocking the HTTP response.
 * Wraps `ExecutionContext.waitUntil` with error logging so unhandled rejections
 * in background tasks do not crash silently.
 *
 * @param c - Hono context (must have backgroundContextMiddleware applied)
 * @param fn - Async function to run in the background
 * @param label - Optional label for logging (helps identify which task failed)
 *
 * @example
 * ```ts
 * app.post('/webhook', async (c) => {
 *   // Return 200 immediately
 *   runInBackground(c, async () => {
 *     await processWebhookEvents(events);
 *   }, 'webhook-processing');
 *   return c.json({ status: 'ok' });
 * });
 * ```
 */
export function runInBackground(c: Context, fn: () => Promise<unknown>, label?: string): void {
	const ctx = c.get("executionCtx");
	const taskLabel = label ?? "anonymous-background-task";

	const wrappedPromise = fn().catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[Background] Task "${taskLabel}" failed: ${message}`);

		// If there is a stack trace, log it separately for structured logging
		if (error instanceof Error && error.stack) {
			console.error(`[Background] Stack trace for "${taskLabel}":`, error.stack);
		}
	});

	ctx.waitUntil(wrappedPromise);
}

// =============================================================================
// Helper: Run with timeout — prevent background tasks from running forever
// =============================================================================

/**
 * Run an async function in the background with a timeout.
 * Cloudflare Workers have a 30-second CPU time limit, but network-bound tasks
 * can run longer. This helper ensures tasks are aborted after a specified duration.
 *
 * @param c - Hono context
 * @param fn - Async function to run (receives AbortSignal for cooperative cancellation)
 * @param timeoutMs - Maximum duration in milliseconds before the task is considered timed out
 * @param label - Optional label for logging
 */
export function runInBackgroundWithTimeout(
	c: Context,
	fn: (signal: AbortSignal) => Promise<unknown>,
	timeoutMs: number,
	label?: string,
): void {
	const ctx = c.get("executionCtx");
	const taskLabel = label ?? "anonymous-timeout-task";
	const controller = new AbortController();

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			controller.abort();
			reject(new Error(`Background task "${taskLabel}" timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	const taskPromise = Promise.race([fn(controller.signal), timeoutPromise]).catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[Background] Task "${taskLabel}" failed: ${message}`);
	});

	ctx.waitUntil(taskPromise);
}
