// =============================================================================
// Hono Factory — Single Env type declaration shared across all modules
// =============================================================================
// The Factory helper (`createFactory<Env>()`) eliminates the need to repeat
// the Env type annotation on every middleware and handler definition.
//
// Before:
//   import { createMiddleware } from 'hono/factory';
//   import type { Env } from '../index.js';
//   export const myMiddleware = createMiddleware<Env>(async (c, next) => { ... });
//
// After:
//   import { createTypedMiddleware } from '../factory.js';
//   export const myMiddleware = createTypedMiddleware(async (c, next) => { ... });
//
// This approach:
//   1. Keeps Env in one place (DRY)
//   2. Gives full type inference for c.env and c.var in middleware
//   3. Provides createTypedHandlers for route handler arrays

import { createFactory } from "hono/factory";
import type { Env } from "./index.js";

// ---------------------------------------------------------------------------
// Factory instance — the single source of Env typing
// ---------------------------------------------------------------------------

/**
 * Hono factory pre-configured with the Worker's Env type.
 * Use `factory.createApp()` for sub-apps, `factory.createMiddleware()`
 * for middleware, and `factory.createHandlers()` for handler arrays.
 */
export const factory = createFactory<Env>();

// ---------------------------------------------------------------------------
// Re-exported typed creators (convenience aliases)
// ---------------------------------------------------------------------------

/**
 * Create a middleware handler with full Env type inference.
 * Equivalent to `createMiddleware<Env>()` but without the generic parameter.
 *
 * @example
 * ```ts
 * import { createTypedMiddleware } from '../factory.js';
 *
 * export const rateLimitMiddleware = createTypedMiddleware(async (c, next) => {
 *   // c.env.DB, c.env.API_KEY etc. are fully typed
 *   const clientIp = c.req.header('cf-connecting-ip');
 *   await next();
 * });
 * ```
 */
export const createTypedMiddleware = factory.createMiddleware;

/**
 * Create a tuple of handlers with full Env type inference.
 * Useful for routes that compose multiple middleware + handler.
 *
 * @example
 * ```ts
 * import { createTypedHandlers } from '../factory.js';
 * import { validateJson } from '../middleware/validate.js';
 * import { requireRole } from '../middleware/role-guard.js';
 *
 * const [guard, validate, handler] = createTypedHandlers(
 *   requireRole('owner', 'admin'),
 *   validateJson(CreateTagSchema),
 *   async (c) => {
 *     const body = c.req.valid('json');
 *     return c.json({ success: true, data: body });
 *   },
 * );
 * ```
 */
export const createTypedHandlers = factory.createHandlers;

// ---------------------------------------------------------------------------
// Typed sub-app creator
// ---------------------------------------------------------------------------

/**
 * Create a new Hono sub-app with the Worker Env type pre-configured.
 * Eliminates `new Hono<Env>()` repetition in route modules.
 *
 * @example
 * ```ts
 * import { createTypedApp } from '../factory.js';
 *
 * const app = createTypedApp();
 * app.get('/api/example', (c) => c.json({ ok: true }));
 * export { app as exampleRoute };
 * ```
 */
export function createTypedApp() {
	return factory.createApp();
}
