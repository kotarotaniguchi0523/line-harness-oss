// =============================================================================
// Structured JSON Logger Middleware
// Outputs structured logs for Cloudflare Workers (Logpush compatible)
// =============================================================================
// Logs each request as a single JSON line with timing, client IP, staff
// context, and user-agent. Designed for Cloudflare Logpush and Workers Logs.
//
// Client IP is extracted via the `getConnInfo` helper which reads the
// `cf-connecting-ip` header set by the Cloudflare edge.

import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/cloudflare-workers";

// ---------------------------------------------------------------------------
// Log entry shape — extends over time as observability needs grow
// ---------------------------------------------------------------------------

interface LogEntry {
	timestamp: string;
	requestId: string;
	method: string;
	path: string;
	status: number;
	durationMs: number;
	clientIp?: string;
	staffId?: string;
	userAgent?: string;
	contentLength?: number;
	error?: string;
}

// ---------------------------------------------------------------------------
// Middleware implementation
// ---------------------------------------------------------------------------

/**
 * Structured logger that outputs JSON lines to console.
 * Compatible with Cloudflare Logpush and Workers Logs.
 * Replaces the default Hono logger() for production use.
 *
 * Enrichment:
 *   - `clientIp`  — from Cloudflare `cf-connecting-ip` via `getConnInfo`
 *   - `staffId`   — set after auth middleware (absent on public routes)
 *   - `userAgent` — raw User-Agent header
 *   - `contentLength` — response body size (from Content-Length header)
 */
export const structuredLogger: MiddlewareHandler = async (c, next) => {
	const start = Date.now();
	const requestId = c.get("requestId" as never) as string | undefined;

	// Extract client IP early (before next()) so it is available even if
	// the downstream handler throws. Uses Cloudflare's cf-connecting-ip header.
	let clientIp: string | undefined;
	try {
		const connInfo = getConnInfo(c);
		clientIp = connInfo.remote.address ?? undefined;
	} catch {
		// getConnInfo may fail in non-CF environments (e.g. vitest).
		// Fallback: try the standard header directly.
		clientIp = c.req.header("cf-connecting-ip") ?? undefined;
	}

	await next();

	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		requestId: requestId ?? "unknown",
		method: c.req.method,
		path: new URL(c.req.url).pathname,
		status: c.res.status,
		durationMs: Date.now() - start,
	};

	// Client IP for security monitoring and rate-limit observability
	if (clientIp) {
		entry.clientIp = clientIp;
	}

	// Add staff context if available (after auth middleware)
	try {
		const staff = c.get("staff" as never) as { id: string } | undefined;
		if (staff) entry.staffId = staff.id;
	} catch {
		// staff not set (public route)
	}

	const ua = c.req.header("user-agent");
	if (ua) entry.userAgent = ua;

	// Response size for bandwidth monitoring
	const contentLength = c.res.headers.get("content-length");
	if (contentLength) {
		entry.contentLength = Number(contentLength);
	}

	// Log level based on status
	if (entry.status >= 500) {
		console.error(JSON.stringify(entry));
	} else if (entry.status >= 400) {
		console.warn(JSON.stringify(entry));
	} else {
		console.log(JSON.stringify(entry));
	}
};
