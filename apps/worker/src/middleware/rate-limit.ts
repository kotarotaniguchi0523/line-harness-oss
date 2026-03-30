// =============================================================================
// Rate Limiting Middleware — Sliding window counter (in-memory Map)
// =============================================================================
// Authenticated: 1000 req/60s (keyed by first 16 chars of API token)
// Unauthenticated: 100 req/60s (keyed by client IP)
// Skip paths: /docs, /openapi.json, /r/*

import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WINDOW_MS = 60_000; // 60 seconds
const AUTHENTICATED_LIMIT = 1_000;
const UNAUTHENTICATED_LIMIT = 100;
const PRUNE_INTERVAL_MS = 60_000;

const SKIP_PATHS = new Set(["/docs", "/openapi.json"]);
const SKIP_PREFIXES = ["/r/"];

// ---------------------------------------------------------------------------
// In-memory sliding window store
// ---------------------------------------------------------------------------

interface WindowEntry {
	count: number;
	resetAt: number; // timestamp when window resets
}

const store = new Map<string, WindowEntry>();

// Auto-prune expired entries every 60 seconds
let lastPrune = Date.now();

function pruneExpired(): void {
	const now = Date.now();
	if (now - lastPrune < PRUNE_INTERVAL_MS) return;
	lastPrune = now;

	for (const [key, entry] of store) {
		if (now >= entry.resetAt) {
			store.delete(key);
		}
	}
}

// ---------------------------------------------------------------------------
// IP detection: cf-connecting-ip > x-forwarded-for > x-real-ip
// ---------------------------------------------------------------------------

function getClientIp(c: Context): string {
	return (
		c.req.header("cf-connecting-ip") ??
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
		c.req.header("x-real-ip") ??
		"unknown"
	);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function rateLimitMiddleware(c: Context, next: Next) {
	const path = new URL(c.req.url).pathname;

	// Skip paths
	if (SKIP_PATHS.has(path) || SKIP_PREFIXES.some((p) => path.startsWith(p))) {
		return next();
	}

	// Determine key and limit based on authentication
	const authHeader = c.req.header("Authorization");
	const isAuthenticated = authHeader?.startsWith("Bearer ");
	const limit = isAuthenticated ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT;

	const key = isAuthenticated
		? `auth:${authHeader?.slice("Bearer ".length, "Bearer ".length + 16)}`
		: `ip:${getClientIp(c)}`;

	// Prune expired entries periodically
	pruneExpired();

	// Get or create window entry
	const now = Date.now();
	let entry = store.get(key);
	if (!entry || now >= entry.resetAt) {
		entry = { count: 0, resetAt: now + WINDOW_MS };
		store.set(key, entry);
	}

	entry.count++;

	if (entry.count > limit) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		c.header("X-RateLimit-Remaining", "0");
		c.header("Retry-After", String(retryAfter));
		return c.json({ success: false, error: "Too many requests. Please try again later." }, 429);
	}

	c.header("X-RateLimit-Remaining", String(limit - entry.count));
	return next();
}
