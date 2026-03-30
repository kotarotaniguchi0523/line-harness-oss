import { AUTH_CONSTANTS, HTTP_ERRORS, PUBLIC_ROUTES } from "@line-crm/contracts";
import { createDb, createStaffRepository } from "@line-crm/db";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "../index.js";

/** Staff context resolved from session or API key authentication */
type StaffContext = { id: string; name: string; role: "owner" | "admin" | "staff" };

export async function authMiddleware(c: Context<Env>, next: Next): Promise<Response | undefined> {
	const path = new URL(c.req.url).pathname;

	// Skip auth for public endpoints (defined in @line-crm/contracts)
	if (
		PUBLIC_ROUTES.paths.has(path) ||
		PUBLIC_ROUTES.prefixes.some((p) => path.startsWith(p)) ||
		PUBLIC_ROUTES.patterns.some((p) => p.test(path)) ||
		path === PUBLIC_ROUTES.rpc
	) {
		await next();
		return;
	}

	// Strategy 1: better-auth session cookie (httpOnly, secure)
	const sessionToken = getCookie(c, AUTH_CONSTANTS.sessionCookieName);
	if (sessionToken) {
		const staff = await verifySessionCookie(c, sessionToken);
		if (staff) {
			c.set("staff", staff);
			await next();
			return;
		}
	}

	// Strategy 2: Bearer token (for external API integrations, MCP, SDK)
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice("Bearer ".length);

		const db = createDb(c.env.DB);
		const staffRepo = createStaffRepository(db);
		const staff = await staffRepo.findByApiKey(token);
		if (staff) {
			c.set("staff", { id: staff.id, name: staff.name, role: staff.role as "owner" | "admin" | "staff" });
			await next();
			return;
		}

		if (token === c.env.API_KEY) {
			c.set("staff", { id: "env-owner", name: "Owner", role: "owner" as const });
			await next();
			return;
		}
	}

	return c.json({ success: false, error: HTTP_ERRORS.unauthorized }, 401);
}

/**
 * Verify a better-auth session cookie.
 *
 * Flow:
 *   1. Check KV cache for a previously verified session token
 *   2. On cache miss, query D1 (session + user + staff_members)
 *   3. Write the result back to KV with a short TTL
 *
 * The cache key uses the `session` domain helper from CacheService so the
 * prefix and TTL are defined in a single place (cache.service.ts constants).
 */
async function verifySessionCookie(c: Context<Env>, sessionToken: string): Promise<StaffContext | null> {
	try {
		const cache = c.get("cache");
		const cacheKey = cache.session.key(sessionToken);

		// 1. Try KV cache first (avoids D1 round-trip on every request)
		const cached = await cache.get<StaffContext>(cacheKey);
		if (cached) {
			return cached;
		}

		// 2. Cache miss — verify against D1
		const result = await c.env.DB.prepare(`
        SELECT s.user_id, u.name, u.email
        FROM session s
        JOIN user u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `)
			.bind(sessionToken)
			.first<{ user_id: string; name: string; email: string }>();

		if (!result) return null;

		// Map better-auth user to staff context
		// Check if user is also a staff member for role info
		const staffRow = await c.env.DB.prepare("SELECT id, role FROM staff_members WHERE email = ? AND is_active = 1")
			.bind(result.email)
			.first<{ id: string; role: string }>();

		const staffContext: StaffContext = {
			id: staffRow?.id ?? result.user_id,
			name: result.name,
			role: (staffRow?.role ?? "staff") as "owner" | "admin" | "staff",
		};

		// 3. Write to KV (non-blocking — don't delay the response)
		cache.set(cacheKey, staffContext, { ttl: cache.session.ttl }).catch(() => {
			/* silently ignore cache write failure */
		});

		return staffContext;
	} catch {
		return null;
	}
}
