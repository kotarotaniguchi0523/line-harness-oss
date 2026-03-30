// =============================================================================
// Drizzle ORM factory — swappable SQLite adapter
// =============================================================================
// Supports: Cloudflare D1, Turso (libSQL), better-sqlite3
// The returned `Database` type is adapter-agnostic; all repositories use it.
// To change the database backend, change only the `createDb()` call site.

import { drizzle as d1Drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index.js";

// ---------------------------------------------------------------------------
// Adapter config (discriminated union)
// ---------------------------------------------------------------------------

export type DbConfig =
	| { driver: "d1"; binding: D1Database }
	| { driver: "turso"; url: string; authToken: string }
	| { driver: "better-sqlite3"; path: string };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Drizzle ORM database instance.
 *
 * Default: D1 adapter (Cloudflare Workers).
 * For D1 (the common case), accepts raw D1Database for backward compat.
 */
export function createDb(configOrD1: DbConfig | D1Database): Database {
	// Backward compat: raw D1Database passed directly
	if (!("driver" in configOrD1)) {
		return d1Drizzle(configOrD1, { schema });
	}

	switch (configOrD1.driver) {
		case "d1":
			return d1Drizzle(configOrD1.binding, { schema });
		case "turso":
			// Lazy import — only loaded when Turso is used
			throw new Error("Turso adapter: use createDbAsync() for async adapters");
		case "better-sqlite3":
			throw new Error("better-sqlite3 adapter: use createDbAsync() for sync adapters");
	}
}

/**
 * Async factory for adapters that require async initialization (Turso, better-sqlite3).
 * Call this at app startup, not per-request.
 */
export async function createDbAsync(config: DbConfig): Promise<Database> {
	switch (config.driver) {
		case "d1":
			return d1Drizzle(config.binding, { schema });
		case "turso": {
			const { drizzle } = await import("drizzle-orm/libsql");
			// @ts-expect-error — optional dependency, install @libsql/client when using Turso
			const { createClient } = await import("@libsql/client");
			const client = createClient({ url: config.url, authToken: config.authToken });
			return drizzle(client, { schema }) as unknown as Database;
		}
		case "better-sqlite3": {
			const { drizzle } = await import("drizzle-orm/better-sqlite3");
			// @ts-expect-error — optional dependency, install better-sqlite3 when using local SQLite
			const BetterSqlite = (await import("better-sqlite3")).default;
			return drizzle(new BetterSqlite(config.path), { schema }) as unknown as Database;
		}
	}
}

// ---------------------------------------------------------------------------
// Database type (adapter-agnostic)
// ---------------------------------------------------------------------------

export type Database = ReturnType<typeof d1Drizzle<typeof schema>>;
