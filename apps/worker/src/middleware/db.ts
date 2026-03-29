// =============================================================================
// Drizzle DB Injection Middleware
// Injects typed Drizzle instance into Hono context
// =============================================================================

import { createDb, type Database } from "@line-crm/db/drizzle";
import { createTypedMiddleware } from "../factory.js";

declare module "hono" {
	interface ContextVariableMap {
		db: Database;
	}
}

/**
 * Middleware that creates a Drizzle ORM instance from D1 binding
 * and injects it into Hono context as `c.get('db')`.
 *
 * Usage in routes:
 * ```ts
 * app.get('/api/friends', async (c) => {
 *   const db = c.get('db');
 *   const friends = await db.select().from(schema.friends);
 *   return c.json({ data: friends });
 * });
 * ```
 */
export const dbMiddleware = createTypedMiddleware(async (c, next) => {
	const db = createDb(c.env.DB);
	c.set("db", db);
	await next();
});
