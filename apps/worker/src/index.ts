import { createDb, createLineAccountRepository } from "@line-crm/db";
import { LineClient } from "@line-crm/line-sdk";
import { Hono } from "hono";
import { applyAuthenticatedMiddleware, applyBaseMiddleware } from "./middleware/combined.js";
import { errorHandler } from "./middleware/error-handler.js";
import { adPlatforms } from "./routes/ad-platforms.js";
import { affiliates } from "./routes/affiliates.js";
import { autoRepliesRoute } from "./routes/auto-replies.js";
import { automations } from "./routes/automations.js";
import { broadcasts } from "./routes/broadcasts.js";
import { calendar } from "./routes/calendar.js";
import { chats } from "./routes/chats.js";
import { conversions } from "./routes/conversions.js";
import { forms } from "./routes/forms.js";
import { friends } from "./routes/friends.js";
import { health } from "./routes/health.js";
import { liffRoutes } from "./routes/liff.js";
import { lineAccounts } from "./routes/line-accounts.js";
// MCP HTTP endpoint (AI agent integration via Streamable HTTP transport)
import { mcpRoute } from "./routes/mcp.js";
import { media } from "./routes/media.js";
import { notifications } from "./routes/notifications.js";
import { openapi } from "./routes/openapi.js";
import { reminders } from "./routes/reminders.js";
import { richMenus } from "./routes/rich-menus.js";
import { scenarios } from "./routes/scenarios.js";
import { scoring } from "./routes/scoring.js";
import { staff } from "./routes/staff.js";
import { stripe } from "./routes/stripe.js";
import { tags } from "./routes/tags.js";
import { templates } from "./routes/templates.js";
import { trackedLinks } from "./routes/tracked-links.js";
import { users } from "./routes/users.js";
import { webhook } from "./routes/webhook.js";
// Round 3 ルート
import { webhooks } from "./routes/webhooks.js";
// Cap'n Web RPC
import { handleRpcRequest } from "./rpc/api-server.js";
import { initSentry } from "./sentry.js";
import { checkAccountHealth } from "./services/ban-monitor.js";
import { processScheduledBroadcasts } from "./services/broadcast.js";
import { processJobBatch } from "./services/job-queue.service.js";
import { processReminderDeliveries } from "./services/reminder-delivery.js";
import { processStepDeliveries } from "./services/step-delivery.js";

export type Env = {
	Bindings: {
		DB: D1Database;
		CACHE: KVNamespace;
		JOB_QUEUE: Queue;
		MEDIA_BUCKET: R2Bucket;
		LINE_CHANNEL_SECRET: string;
		LINE_CHANNEL_ACCESS_TOKEN: string;
		API_KEY: string;
		LIFF_URL: string;
		LINE_CHANNEL_ID: string;
		LINE_LOGIN_CHANNEL_ID: string;
		LINE_LOGIN_CHANNEL_SECRET: string;
		WORKER_URL: string;
		X_HARNESS_URL?: string; // Optional: X Harness API URL for account linking
		STRIPE_WEBHOOK_SECRET?: string; // Stripe webhook signing secret for signature verification
		GOOGLE_CLIENT_ID?: string; // Google OAuth client ID for Calendar token refresh
		GOOGLE_CLIENT_SECRET?: string; // Google OAuth client secret for Calendar token refresh
		WORKER_LOADER?: WorkerLoader; // Optional: Workers for Platforms binding for CodeMode sandbox
		BETTER_AUTH_SECRET?: string; // better-auth session signing secret
		BETTER_AUTH_URL?: string; // better-auth public URL
		CORS_ORIGIN?: string; // CORS allowed origin
	};
	Variables: {
		staff: { id: string; name: string; role: "owner" | "admin" | "staff" };
	};
};

const app = new Hono<Env>();

// ============================================================
// Middleware Stack (via combined.ts presets)
// ============================================================

// Base: requestId, logger, timing, secureHeaders, cors, bodyLimit, etag, DB, cache, background
applyBaseMiddleware(app);

// Global error handler — HTTPException, ZodError, unhandled
app.onError(errorHandler);

// Auth + Service DI (applied after base)
applyAuthenticatedMiddleware(app);

// Mount route groups — MVP & Round 2
app.route("/", webhook);
app.route("/", friends);
app.route("/", tags);
app.route("/", scenarios);
app.route("/", broadcasts);
app.route("/", users);
app.route("/", lineAccounts);
app.route("/", conversions);
app.route("/", affiliates);
app.route("/", openapi);
app.route("/", liffRoutes);

// Mount route groups — Round 3
app.route("/", webhooks);
app.route("/", calendar);
app.route("/", reminders);
app.route("/", scoring);
app.route("/", templates);
app.route("/", chats);
app.route("/", notifications);
app.route("/", stripe);
app.route("/", health);
app.route("/", automations);
app.route("/", richMenus);
app.route("/", trackedLinks);
app.route("/", forms);
app.route("/", adPlatforms);
app.route("/", staff);
app.route("/", autoRepliesRoute);
app.route("/", media);
app.route("/", mcpRoute);

// better-auth handler — serves /api/auth/** endpoints (sign-in, sign-up, session, etc.)
app.on(["GET", "POST"], "/api/auth/**", async (c) => {
	const { betterAuth } = await import("better-auth");
	const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
	const db = c.get("db");
	const auth = betterAuth({
		database: drizzleAdapter(db, { provider: "sqlite" }),
		trustedOrigins: c.env.CORS_ORIGIN ? [c.env.CORS_ORIGIN] : [],
		emailAndPassword: { enabled: true },
		secret: c.env.BETTER_AUTH_SECRET ?? c.env.API_KEY,
		baseURL: c.env.BETTER_AUTH_URL ?? c.env.WORKER_URL,
		session: { cookieCache: { enabled: true, maxAge: 60 } },
		advanced: {
			defaultCookieAttributes: { sameSite: "none", secure: true, httpOnly: true },
		},
	});
	return auth.handler(c.req.raw);
});

// Cap'n Web RPC endpoint (authenticated via object-capability)
app.all("/rpc", (c) => {
	return handleRpcRequest(c.req.raw, {
		DB: c.env.DB,
		API_KEY: c.env.API_KEY,
		LINE_CHANNEL_ACCESS_TOKEN: c.env.LINE_CHANNEL_ACCESS_TOKEN,
		LINE_CHANNEL_SECRET: c.env.LINE_CHANNEL_SECRET,
		WORKER_URL: c.env.WORKER_URL,
		LIFF_URL: c.env.LIFF_URL,
	});
});

// Short link: /r/:ref → landing page with LINE open button
app.get("/r/:ref", (c) => {
	const ref = c.req.param("ref");
	const liffUrl = c.env.LIFF_URL;
	if (!liffUrl) return c.json({ success: false, error: "LIFF_URL not configured" }, 500);
	const target = `${liffUrl}?ref=${encodeURIComponent(ref)}`;

	return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LINE Harness</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hiragino Sans',system-ui,sans-serif;background:#0d1117;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center;max-width:400px;width:90%;padding:48px 24px}
h1{font-size:28px;font-weight:800;margin-bottom:8px}
.sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:40px}
.btn{display:block;width:100%;padding:18px;border:none;border-radius:12px;font-size:18px;font-weight:700;text-decoration:none;text-align:center;color:#fff;background:#06C755;transition:opacity .15s}
.btn:active{opacity:.85}
.note{font-size:12px;color:rgba(255,255,255,0.3);margin-top:24px;line-height:1.6}
</style>
</head>
<body>
<div class="card">
<h1>LINE Harness</h1>
<p class="sub">L社 / U社 の無料代替 OSS</p>
<a href="${target}" class="btn">LINE で体験する</a>
<p class="note">友だち追加するだけで<br>ステップ配信・フォーム・自動返信を体験できます</p>
</div>
</body>
</html>`);
});

// 404 fallback
app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

// Scheduled handler for cron triggers — runs for all active LINE accounts
async function scheduled(_event: ScheduledEvent, env: Env["Bindings"], _ctx: ExecutionContext): Promise<void> {
	// Get all active accounts from DB, plus the default env account
	const db = createDb(env.DB);
	const accountRepo = createLineAccountRepository(db);
	const dbAccounts = await accountRepo.list();
	const activeTokens = new Set<string>();

	// Default account from env
	activeTokens.add(env.LINE_CHANNEL_ACCESS_TOKEN);

	// DB accounts
	for (const account of dbAccounts) {
		if (account.isActive) {
			activeTokens.add(account.channelAccessToken);
		}
	}

	// Run delivery for each account
	const jobs = [];
	for (const token of activeTokens) {
		const lineClient = new LineClient(token);
		jobs.push(
			processStepDeliveries(env.DB, lineClient, env.WORKER_URL),
			processScheduledBroadcasts(env.DB, lineClient, env.WORKER_URL),
			processReminderDeliveries(env.DB, lineClient),
		);
	}
	jobs.push(checkAccountHealth(env.DB));

	await Promise.allSettled(jobs);
}

export default {
	fetch(request: Request, env: Env["Bindings"], ctx: ExecutionContext) {
		initSentry(env as unknown as { SENTRY_DSN?: string });
		return app.fetch(request, env, ctx);
	},
	scheduled,
	async queue(batch: MessageBatch, env: Env["Bindings"], _ctx: ExecutionContext): Promise<void> {
		await processJobBatch(batch, env);
	},
};
