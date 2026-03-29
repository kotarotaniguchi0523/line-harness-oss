// =============================================================================
// KV-backed Cache Service
// Provides caching with TTL and stale-while-revalidate pattern for
// high-traffic paths: LINE profiles, sessions, tags, automations, etc.
// =============================================================================

// ---------------------------------------------------------------------------
// Cache TTL constants (seconds) — single source of truth for all cache durations
// ---------------------------------------------------------------------------

/** Cache TTL constants (seconds) */
export const CACHE_TTL = {
	/** LINE profile (rarely changes) */
	LINE_PROFILE: 3600, // 1 hour
	/** LINE account settings */
	LINE_ACCOUNT: 1800, // 30 min
	/** Rich menu list (changes infrequently) */
	RICH_MENUS: 600, // 10 min
	/** Session validation result */
	SESSION: 300, // 5 min
	/** Tag list (changes infrequently) */
	TAGS: 300, // 5 min
	/** Automation rules */
	AUTOMATIONS: 120, // 2 min
	/** Stale-while-revalidate grace period added on top of TTL */
	SWR_GRACE: 60, // 1 min
} as const;

// ---------------------------------------------------------------------------
// Cache key prefixes (namespaced to avoid collisions across domains)
// ---------------------------------------------------------------------------

/** Cache key prefixes (namespaced to avoid collisions) */
export const CACHE_PREFIX = {
	LINE_PROFILE: "lp:",
	LINE_ACCOUNT: "la:",
	RICH_MENUS: "rm:",
	SESSION: "sess:",
	TAGS: "tags:",
	AUTOMATIONS: "auto:",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheOptions {
	/** TTL in seconds */
	ttl: number;
	/** If true, return stale data while revalidating in background */
	staleWhileRevalidate?: boolean;
}

/** Wrapper stored in KV to support stale-while-revalidate */
interface CacheEnvelope<T> {
	/** The cached payload */
	data: T;
	/** Unix timestamp (ms) when this entry was written */
	storedAt: number;
	/** TTL that was requested when the entry was written (seconds) */
	requestedTtl: number;
}

// ---------------------------------------------------------------------------
// Cache service type (exported for ContextVariableMap augmentation)
// ---------------------------------------------------------------------------

export type CacheService = ReturnType<typeof createCacheService>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a KV-backed cache service.
 *
 * The service provides:
 * - Generic get/set with TTL
 * - `getOrFetch` with optional stale-while-revalidate
 * - Targeted invalidation (single key or prefix-based)
 * - Domain-specific key helpers for LINE profiles, tags, sessions, etc.
 *
 * @param kv - Cloudflare KV namespace binding
 */
export function createCacheService(kv: KVNamespace) {
	// ----------------------------------------------------------
	// Internal helpers
	// ----------------------------------------------------------

	async function getRaw<T>(key: string): Promise<CacheEnvelope<T> | null> {
		const raw = await kv.get(key);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as CacheEnvelope<T>;
		} catch {
			// Corrupted entry — treat as miss
			return null;
		}
	}

	// ----------------------------------------------------------
	// Public API
	// ----------------------------------------------------------

	return {
		/**
		 * Read a value from cache.
		 * Returns `null` on miss or if the entry is corrupted.
		 */
		async get<T>(key: string): Promise<T | null> {
			const envelope = await getRaw<T>(key);
			if (!envelope) return null;
			return envelope.data;
		},

		/**
		 * Write a value to cache with a TTL.
		 * The KV expiration is set to `ttl + SWR_GRACE` so that stale reads
		 * are possible during the grace window.
		 */
		async set<T>(key: string, value: T, opts: CacheOptions): Promise<void> {
			const envelope: CacheEnvelope<T> = {
				data: value,
				storedAt: Date.now(),
				requestedTtl: opts.ttl,
			};
			const kvTtl = opts.staleWhileRevalidate ? opts.ttl + CACHE_TTL.SWR_GRACE : opts.ttl;
			await kv.put(key, JSON.stringify(envelope), {
				expirationTtl: kvTtl,
			});
		},

		/**
		 * Get a cached value or fetch it from the origin.
		 *
		 * When `staleWhileRevalidate` is enabled the method returns stale data
		 * immediately if the TTL has expired but the KV entry is still alive
		 * (within the SWR grace window), and triggers a background revalidation.
		 *
		 * @param key     - Cache key
		 * @param fetcher - Async function that produces the fresh value
		 * @param opts    - TTL and SWR options
		 */
		async getOrFetch<T>(key: string, fetcher: () => Promise<T>, opts: CacheOptions): Promise<T> {
			const envelope = await getRaw<T>(key);

			if (envelope) {
				const ageMs = Date.now() - envelope.storedAt;
				const ttlMs = envelope.requestedTtl * 1_000;
				const isFresh = ageMs < ttlMs;

				if (isFresh) {
					return envelope.data;
				}

				// Entry is stale but still in KV (within SWR grace)
				if (opts.staleWhileRevalidate) {
					// Return stale data immediately; single background revalidation
					fetcher()
						.then((fresh) => this.set(key, fresh, opts))
						.catch(() => {
							/* silently ignore background revalidation failure */
						});
					return envelope.data;
				}
			}

			// Cache miss or stale without SWR — fetch synchronously
			const fresh = await fetcher();
			// Non-blocking cache write
			this.set(key, fresh, opts).catch(() => {
				/* silently ignore cache write failure */
			});
			return fresh;
		},

		/**
		 * Remove a single key from cache.
		 */
		async invalidate(key: string): Promise<void> {
			await kv.delete(key);
		},

		/**
		 * Remove all keys that share a given prefix.
		 * Uses KV list to enumerate keys (max 1 000 per call by Cloudflare).
		 * For very large namespaces this may need pagination; the current
		 * implementation handles the common case where prefix cardinality is low.
		 */
		async invalidatePrefix(prefix: string): Promise<void> {
			let cursor: string | undefined;
			do {
				const listResult = await kv.list({ prefix, cursor });
				if (listResult.keys.length > 0) {
					await Promise.all(listResult.keys.map((k) => kv.delete(k.name)));
				}
				cursor = listResult.list_complete ? undefined : (listResult.cursor ?? undefined);
			} while (cursor);
		},

		// ----------------------------------------------------------
		// Domain-specific key builders & TTLs
		// Centralised here so callers never hard-code prefixes or durations.
		// ----------------------------------------------------------

		lineProfile: {
			key: (userId: string) => `${CACHE_PREFIX.LINE_PROFILE}${userId}`,
			ttl: CACHE_TTL.LINE_PROFILE,
		},

		lineAccount: {
			key: (accountId: string) => `${CACHE_PREFIX.LINE_ACCOUNT}${accountId}`,
			ttl: CACHE_TTL.LINE_ACCOUNT,
		},

		richMenus: {
			key: (accountId: string) => `${CACHE_PREFIX.RICH_MENUS}${accountId}`,
			ttl: CACHE_TTL.RICH_MENUS,
		},

		tags: {
			key: (accountId: string) => `${CACHE_PREFIX.TAGS}${accountId}`,
			ttl: CACHE_TTL.TAGS,
		},

		session: {
			key: (token: string) => `${CACHE_PREFIX.SESSION}${token}`,
			ttl: CACHE_TTL.SESSION,
		},

		automations: {
			key: (eventType: string) => `${CACHE_PREFIX.AUTOMATIONS}${eventType}`,
			ttl: CACHE_TTL.AUTOMATIONS,
		},
	};
}
