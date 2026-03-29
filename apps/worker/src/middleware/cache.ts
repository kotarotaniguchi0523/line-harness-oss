// =============================================================================
// Cache Middleware for Hono
// Injects a KV-backed CacheService into the Hono context so that route
// handlers and other middleware can access it via `c.get('cache')`.
//
// Usage in routes:
// ```ts
// app.get('/api/tags', async (c) => {
//   const cache = c.get('cache');
//   const tags = await cache.getOrFetch(
//     cache.tags.key('default'),
//     () => getTags(c.env.DB),
//     { ttl: cache.tags.ttl },
//   );
//   return c.json({ data: tags });
// });
// ```
// =============================================================================

import { createTypedMiddleware } from "../factory.js";
import { type CacheService, createCacheService } from "../services/cache.service.js";

// ---------------------------------------------------------------------------
// Augment Hono's ContextVariableMap so that `c.get('cache')` is fully typed
// throughout the entire application without additional casting.
// ---------------------------------------------------------------------------

declare module "hono" {
	interface ContextVariableMap {
		cache: CacheService;
	}
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Hono middleware that creates a CacheService from the `CACHE` KV binding
 * and stores it in context.
 *
 * Must be registered **after** any middleware that validates env bindings
 * and **before** routes or middleware that need caching (e.g. authMiddleware).
 *
 * ```ts
 * // In index.ts middleware stack:
 * app.use('*', dbMiddleware);
 * app.use('*', cacheMiddleware);   // <-- here
 * app.use('*', authMiddleware);
 * ```
 *
 * If the `CACHE` KV binding is not present (e.g. local dev without KV)
 * the middleware creates a no-op cache that always misses. This prevents
 * the application from crashing and allows gradual rollout.
 */
export const cacheMiddleware = createTypedMiddleware(async (c, next) => {
	const kvBinding = c.env.CACHE as KVNamespace | undefined;

	if (kvBinding) {
		const cache = createCacheService(kvBinding);
		c.set("cache", cache);
	} else {
		// Fallback: no-op cache for environments without KV binding
		c.set("cache", createNoOpCacheService());
	}

	await next();
});

// ---------------------------------------------------------------------------
// No-op cache (used when KV binding is absent)
// ---------------------------------------------------------------------------

/**
 * Returns a CacheService-compatible object that never caches anything.
 * Useful for local development or environments without a KV namespace.
 */
function createNoOpCacheService(): CacheService {
	return {
		async get<T>(_key: string): Promise<T | null> {
			return null;
		},
		async set<T>(_key: string, _value: T): Promise<void> {
			// intentional no-op
		},
		async getOrFetch<T>(_key: string, fetcher: () => Promise<T>): Promise<T> {
			return fetcher();
		},
		async invalidate(_key: string): Promise<void> {
			// intentional no-op
		},
		async invalidatePrefix(_prefix: string): Promise<void> {
			// intentional no-op
		},

		// Domain helpers — still provide keys/ttls for consistency
		lineProfile: {
			key: (userId: string) => `lp:${userId}`,
			ttl: 3600,
		},
		lineAccount: {
			key: (accountId: string) => `la:${accountId}`,
			ttl: 1800,
		},
		richMenus: {
			key: (accountId: string) => `rm:${accountId}`,
			ttl: 600,
		},
		tags: {
			key: (accountId: string) => `tags:${accountId}`,
			ttl: 300,
		},
		session: {
			key: (token: string) => `sess:${token}`,
			ttl: 300,
		},
		automations: {
			key: (eventType: string) => `auto:${eventType}`,
			ttl: 120,
		},
	} as CacheService;
}
