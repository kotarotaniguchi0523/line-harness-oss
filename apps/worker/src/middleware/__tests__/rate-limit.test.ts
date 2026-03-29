// NOTE: The rate-limit middleware implementation is pending.
// These tests define the expected behavior based on the interface specification.
// Once the implementation lands, update the import path if necessary.

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The middleware is expected to be exported from this path:
// import { rateLimiter } from "../rate-limit.js";

// ── Inline stub until the real middleware is created ─────────────────────────
// This minimal implementation satisfies the test contract. Replace with the
// real import once the middleware file exists.

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

function rateLimiter(opts: {
	limit: number;
	windowMs: number;
	keyFn?: (c: { req: { header: (n: string) => string | undefined; url: string } }) => string;
	skip?: (c: { req: { path: string } }) => boolean;
}) {
	const store: RateLimitStore = new Map();
	return async (c: any, next: () => Promise<void>) => {
		if (opts.skip?.(c)) {
			return next();
		}

		const key = opts.keyFn ? opts.keyFn(c) : (c.req.header("x-real-ip") ?? "anonymous");
		const now = Date.now();
		let entry = store.get(key);

		if (!entry || now >= entry.resetAt) {
			entry = { count: 0, resetAt: now + opts.windowMs };
			store.set(key, entry);
		}

		entry.count++;

		const remaining = Math.max(0, opts.limit - entry.count);
		c.header("X-RateLimit-Limit", String(opts.limit));
		c.header("X-RateLimit-Remaining", String(remaining));

		if (entry.count > opts.limit) {
			const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
			c.header("Retry-After", String(retryAfter));
			return c.json({ success: false, error: "Too many requests" }, 429);
		}

		return next();
	};
}
// ── End stub ────────────────────────────────────────────────────────────────

function createApp(overrides?: Parameters<typeof rateLimiter>[0]) {
	const app = new Hono();
	app.use(
		"*",
		rateLimiter({
			limit: 5,
			windowMs: 60_000,
			skip: (c) => ["/docs", "/openapi.json"].some((p) => c.req.path.startsWith(p)),
			...overrides,
		}),
	);
	app.get("/api/friends", (c) => c.json({ ok: true }));
	app.get("/docs", (c) => c.json({ ok: true }));
	app.get("/openapi.json", (c) => c.json({ ok: true }));
	return app;
}

describe("rateLimiter middleware", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns 200 for requests under limit", async () => {
		const app = createApp();
		const res = await app.request("/api/friends", {
			headers: { "x-real-ip": "1.2.3.4" },
		});
		expect(res.status).toBe(200);
	});

	it("returns 429 when limit is exceeded", async () => {
		const app = createApp({ limit: 3, windowMs: 60_000 });

		for (let i = 0; i < 3; i++) {
			const res = await app.request("/api/friends", {
				headers: { "x-real-ip": "1.2.3.4" },
			});
			expect(res.status).toBe(200);
		}

		const res = await app.request("/api/friends", {
			headers: { "x-real-ip": "1.2.3.4" },
		});
		expect(res.status).toBe(429);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toMatch(/too many requests/i);
	});

	it("resets after window expires", async () => {
		const app = createApp({ limit: 2, windowMs: 10_000 });

		// Exhaust the limit
		await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });

		const blocked = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(blocked.status).toBe(429);

		// Advance time past the window
		vi.advanceTimersByTime(11_000);

		const allowed = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(allowed.status).toBe(200);
	});

	it("uses different keys for different IPs", async () => {
		const app = createApp({ limit: 1, windowMs: 60_000 });

		const res1 = await app.request("/api/friends", { headers: { "x-real-ip": "10.0.0.1" } });
		expect(res1.status).toBe(200);

		// Same IP should be blocked
		const res2 = await app.request("/api/friends", { headers: { "x-real-ip": "10.0.0.1" } });
		expect(res2.status).toBe(429);

		// Different IP should still succeed
		const res3 = await app.request("/api/friends", { headers: { "x-real-ip": "10.0.0.2" } });
		expect(res3.status).toBe(200);
	});

	it("uses custom keyFn for authenticated vs unauthenticated", async () => {
		const app = createApp({
			limit: 1,
			windowMs: 60_000,
			keyFn: (c) => c.req.header("authorization") ?? c.req.header("x-real-ip") ?? "anon",
		});

		// Authenticated user: keyed by token
		const res1 = await app.request("/api/friends", {
			headers: { authorization: "Bearer user-1", "x-real-ip": "1.1.1.1" },
		});
		expect(res1.status).toBe(200);

		// Same token, blocked
		const res2 = await app.request("/api/friends", {
			headers: { authorization: "Bearer user-1", "x-real-ip": "2.2.2.2" },
		});
		expect(res2.status).toBe(429);

		// Different token, allowed
		const res3 = await app.request("/api/friends", {
			headers: { authorization: "Bearer user-2", "x-real-ip": "1.1.1.1" },
		});
		expect(res3.status).toBe(200);
	});

	it("skips rate limiting for excluded paths (/docs)", async () => {
		const app = createApp({ limit: 1, windowMs: 60_000 });

		// First request to API exhausts the limit
		await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		const blocked = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(blocked.status).toBe(429);

		// /docs should always pass, regardless of rate limit state
		const docs = await app.request("/docs", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(docs.status).toBe(200);
	});

	it("skips rate limiting for /openapi.json", async () => {
		const app = createApp({ limit: 1, windowMs: 60_000 });

		await app.request("/api/friends", { headers: { "x-real-ip": "5.5.5.5" } });
		const blocked = await app.request("/api/friends", { headers: { "x-real-ip": "5.5.5.5" } });
		expect(blocked.status).toBe(429);

		const openapi = await app.request("/openapi.json", { headers: { "x-real-ip": "5.5.5.5" } });
		expect(openapi.status).toBe(200);
	});

	it("sets X-RateLimit-Remaining header", async () => {
		const app = createApp({ limit: 3, windowMs: 60_000 });

		const res1 = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(res1.headers.get("X-RateLimit-Remaining")).toBe("2");

		const res2 = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(res2.headers.get("X-RateLimit-Remaining")).toBe("1");

		const res3 = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(res3.headers.get("X-RateLimit-Remaining")).toBe("0");
	});

	it("sets Retry-After header on 429 response", async () => {
		const app = createApp({ limit: 1, windowMs: 30_000 });

		await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		const blocked = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(blocked.status).toBe(429);

		const retryAfter = blocked.headers.get("Retry-After");
		expect(retryAfter).toBeDefined();
		expect(Number(retryAfter)).toBeGreaterThan(0);
		expect(Number(retryAfter)).toBeLessThanOrEqual(30);
	});

	it("sets X-RateLimit-Limit header", async () => {
		const app = createApp({ limit: 10, windowMs: 60_000 });
		const res = await app.request("/api/friends", { headers: { "x-real-ip": "1.2.3.4" } });
		expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
	});
});
