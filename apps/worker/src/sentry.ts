// =============================================================================
// Sentry Configuration for Cloudflare Workers
// =============================================================================
// @sentry/cloudflare uses withSentry() wrapper pattern, not init().
// See: https://docs.sentry.io/platforms/javascript/guides/cloudflare/

import { captureException, setExtra, setTag } from "@sentry/cloudflare";

/**
 * Initialize Sentry context for a request.
 * For Cloudflare Workers, Sentry is configured via wrangler.toml
 * and the Sentry integration is enabled at the platform level.
 * This helper wraps captureException for convenience.
 */
export function initSentry(_env: { SENTRY_DSN?: string }) {
	// Sentry for CF Workers is configured via wrangler.toml tail_consumers
	// This function is a no-op placeholder for the init pattern
}

export { captureException, setExtra, setTag };
