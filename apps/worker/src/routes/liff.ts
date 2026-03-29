import {
	addTagToFriend,
	createFriendRepository,
	createScenarioRepository,
	createTagRepository,
	createUser,
	type Database,
	DateTime,
	getEntryRouteByRefCode,
	getFriendByLineUserId,
	getLineAccountByChannelId,
	getLineAccounts,
	getUserByEmail,
	linkFriendToUser,
	recordRefTracking,
	upsertFriend,
} from "@line-crm/db";
import { friendScenarios, friends, tags } from "@line-crm/db/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Env } from "../index.js";

const LIFF_ID_PATTERN = /liff\.line\.me\/([0-9]+-[A-Za-z0-9]+)/;
const MOBILE_UA_PATTERN = /iphone|ipad|android|mobile/;
const LIFF_ID_FROM_URL_PATTERN = /liff\.line\.me\/([^?]+)/;

/** Resolve LINE Login channel ID + secret from DB for multi-account support */
async function resolveLoginCredentials(
	db: D1Database,
	accountParam: string,
	defaultChannelId: string,
	defaultChannelSecret: string,
): Promise<{ loginChannelId: string; loginChannelSecret: string }> {
	if (!accountParam) return { loginChannelId: defaultChannelId, loginChannelSecret: defaultChannelSecret };
	const account = await getLineAccountByChannelId(db, accountParam);
	if (account?.login_channel_id && account?.login_channel_secret) {
		return { loginChannelId: account.login_channel_id, loginChannelSecret: account.login_channel_secret };
	}
	return { loginChannelId: defaultChannelId, loginChannelSecret: defaultChannelSecret };
}

/** Verify LINE ID token and fetch profile. Returns null if verification fails. */
async function verifyAndFetchProfile(
	idToken: string,
	accessToken: string,
	loginChannelId: string,
): Promise<{
	verified: { sub: string; name?: string; email?: string };
	displayName: string;
	pictureUrl: string | null;
} | null> {
	const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ id_token: idToken, client_id: loginChannelId }),
	});
	if (!verifyRes.ok) return null;

	const verified = await verifyRes.json<{ sub: string; name?: string; email?: string; picture?: string }>();

	const profileRes = await fetch("https://api.line.me/v2/profile", {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	let displayName = verified.name || "Unknown";
	let pictureUrl: string | null = null;
	if (profileRes.ok) {
		const profile = await profileRes.json<{ userId: string; displayName: string; pictureUrl?: string }>();
		displayName = profile.displayName;
		pictureUrl = profile.pictureUrl || null;
	}

	return { verified, displayName, pictureUrl };
}

/** Try to redirect to the bot's friend-add page for cross-account flows. Returns the redirect URL or null. */
async function resolveBotFriendAddUrl(db: D1Database, accountParam: string): Promise<string | null> {
	if (!accountParam) return null;
	const account = await getLineAccountByChannelId(db, accountParam);
	if (!account) return null;
	try {
		const botInfo = await fetch("https://api.line.me/v2/bot/info", {
			headers: { Authorization: `Bearer ${account.channel_access_token}` },
		});
		if (botInfo.ok) {
			const bot = (await botInfo.json()) as { basicId?: string };
			if (bot.basicId) return `https://line.me/R/ti/p/${bot.basicId}`;
		}
	} catch {
		// Fall through
	}
	return null;
}

/** Resolve LINE Login channel ID and LIFF URL from DB for multi-account support */
async function resolveAccountCredentials(
	db: D1Database,
	accountParam: string,
	defaultChannelId: string,
	defaultLiffUrl: string,
): Promise<{ channelId: string; liffUrl: string }> {
	let channelId = defaultChannelId;
	let liffUrl = defaultLiffUrl;
	if (accountParam) {
		const account = await getLineAccountByChannelId(db, accountParam);
		if (account?.login_channel_id) channelId = account.login_channel_id;
		if (account?.liff_id) liffUrl = `https://liff.line.me/${account.liff_id}`;
	}
	return { channelId, liffUrl };
}

/** Build the LINE OAuth authorization URL with all tracking params encoded in state */
function buildOAuthUrl(channelId: string, callbackUrl: string, statePayload: Record<string, string>): URL {
	const encodedState = btoa(JSON.stringify(statePayload));
	const loginUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
	loginUrl.searchParams.set("response_type", "code");
	loginUrl.searchParams.set("client_id", channelId);
	loginUrl.searchParams.set("redirect_uri", callbackUrl);
	loginUrl.searchParams.set("scope", "profile openid email");
	loginUrl.searchParams.set("bot_prompt", "aggressive");
	loginUrl.searchParams.set("state", encodedState);
	return loginUrl;
}

/** Build the LIFF QR URL with ref and account params (no xh: tokens) */
function buildQrUrl(liffUrl: string, externalRef: string, uidParam: string, accountParam: string): string {
	const qrParams = new URLSearchParams();
	if (externalRef) qrParams.set("ref", externalRef);
	if (uidParam) qrParams.set("uid", uidParam);
	if (accountParam) qrParams.set("account", accountParam);
	return qrParams.toString() ? `${liffUrl}?${qrParams.toString()}` : liffUrl;
}

const liffRoutes = new Hono<Env>();

// ─── LINE Login OAuth (bot_prompt=aggressive) ───────────────────

/**
 * GET /auth/line — redirect to LINE Login with bot_prompt=aggressive
 *
 * This is THE friend-add URL. Put this on LPs, SNS, ads.
 * Query params:
 *   ?ref=xxx     — attribution tracking
 *   ?redirect=url — redirect after completion
 *   ?gclid=xxx   — Google Ads click ID
 *   ?fbclid=xxx  — Meta Ads click ID
 *   ?utm_source=xxx, utm_medium, utm_campaign, utm_content, utm_term — UTM params
 */
liffRoutes.get("/auth/line", async (c) => {
	const ref = c.req.query("ref") || "";
	const redirect = c.req.query("redirect") || "";
	const gclid = c.req.query("gclid") || "";
	const fbclid = c.req.query("fbclid") || "";
	const twclid = c.req.query("twclid") || "";
	const ttclid = c.req.query("ttclid") || "";
	const utmSource = c.req.query("utm_source") || "";
	const utmMedium = c.req.query("utm_medium") || "";
	const utmCampaign = c.req.query("utm_campaign") || "";
	const accountParam = c.req.query("account") || "";
	const uidParam = c.req.query("uid") || ""; // existing user UUID for cross-account linking
	const baseUrl = new URL(c.req.url).origin;

	const { channelId, liffUrl } = await resolveAccountCredentials(
		c.env.DB,
		accountParam,
		c.env.LINE_LOGIN_CHANNEL_ID,
		c.env.LIFF_URL,
	);
	const callbackUrl = `${baseUrl}/auth/callback`;

	// xh: refs are X Harness one-time tokens -- never forward to third-party URLs
	const externalRef = ref.startsWith("xh:") ? "" : ref;

	// Build LIFF URL with ref + ad params (for mobile -> LINE app)
	const liffIdMatch = liffUrl.match(LIFF_ID_PATTERN);
	const liffParams = new URLSearchParams();
	if (liffIdMatch) liffParams.set("liffId", liffIdMatch[1]);
	if (externalRef) liffParams.set("ref", externalRef);
	if (redirect) liffParams.set("redirect", redirect);
	if (gclid) liffParams.set("gclid", gclid);
	if (fbclid) liffParams.set("fbclid", fbclid);
	if (twclid) liffParams.set("twclid", twclid);
	if (ttclid) liffParams.set("ttclid", ttclid);
	if (utmSource) liffParams.set("utm_source", utmSource);
	const _liffTarget = liffParams.toString() ? `${liffUrl}?${liffParams.toString()}` : liffUrl;

	const loginUrl = buildOAuthUrl(channelId, callbackUrl, {
		ref,
		redirect,
		gclid,
		fbclid,
		twclid,
		ttclid,
		utmSource,
		utmMedium,
		utmCampaign,
		account: accountParam,
		uid: uidParam,
	});

	const qrUrl = buildQrUrl(liffUrl, externalRef, uidParam, accountParam);

	// Mobile: redirect to LIFF URL (opens LINE app directly)
	// Exception: cross-account links (account param) use OAuth directly
	const ua = (c.req.header("user-agent") || "").toLowerCase();
	const isMobile = MOBILE_UA_PATTERN.test(ua);
	if (isMobile) {
		if (accountParam) return c.redirect(loginUrl.toString());
		return c.redirect(qrUrl);
	}

	// PC: show QR code page
	return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE で友だち追加</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #0d1117; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 48px; text-align: center; max-width: 480px; width: 90%; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    .sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 32px; }
    .qr { background: #fff; border-radius: 16px; padding: 24px; display: inline-block; margin-bottom: 24px; }
    .qr img { display: block; width: 240px; height: 240px; }
    .hint { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.6; }
    .badge { display: inline-block; margin-top: 24px; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #06C755; background: rgba(6,199,85,0.1); border: 1px solid rgba(6,199,85,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <h1>全機能を使う（0円）</h1>
    <p class="sub">スマートフォンで QR コードを読み取ってください</p>
    <div class="qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}" alt="QR Code">
    </div>
    <p class="hint">LINE アプリのカメラまたは<br>スマートフォンのカメラで読み取れます</p>
    <div class="badge">LINE Harness OSS</div>
  </div>
</body>
</html>`);
});

/** Parse the base64-encoded OAuth state parameter into tracking fields */
function parseCallbackState(stateParam: string): {
	ref: string;
	redirect: string;
	gclid: string;
	fbclid: string;
	twclid: string;
	ttclid: string;
	utmSource: string;
	utmMedium: string;
	utmCampaign: string;
	accountParam: string;
	uidParam: string;
} {
	const defaults = {
		ref: "",
		redirect: "",
		gclid: "",
		fbclid: "",
		twclid: "",
		ttclid: "",
		utmSource: "",
		utmMedium: "",
		utmCampaign: "",
		accountParam: "",
		uidParam: "",
	};
	try {
		const parsed = JSON.parse(atob(stateParam));
		return {
			ref: parsed.ref || "",
			redirect: parsed.redirect || "",
			gclid: parsed.gclid || "",
			fbclid: parsed.fbclid || "",
			twclid: parsed.twclid || "",
			ttclid: parsed.ttclid || "",
			utmSource: parsed.utmSource || "",
			utmMedium: parsed.utmMedium || "",
			utmCampaign: parsed.utmCampaign || "",
			accountParam: parsed.account || "",
			uidParam: parsed.uid || "",
		};
	} catch {
		return defaults;
	}
}

/** Exchange authorization code for LINE tokens */
async function exchangeTokens(
	code: string,
	callbackUrl: string,
	channelId: string,
	channelSecret: string,
): Promise<{ access_token: string; id_token: string } | null> {
	const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: callbackUrl,
			client_id: channelId,
			client_secret: channelSecret,
		}),
	});
	if (!tokenRes.ok) {
		console.error("Token exchange failed:", await tokenRes.text());
		return null;
	}
	return tokenRes.json<{ access_token: string; id_token: string }>();
}

/** Resolve or create a user identity and link it to the friend */
async function resolveUserIdentity(
	db: D1Database,
	friend: { id: string; user_id?: string | null },
	verified: { email?: string; name?: string },
	uidParam: string,
	displayName: string,
): Promise<string> {
	const existingUserId = (friend as unknown as Record<string, unknown>).user_id as string | null;
	if (existingUserId) return existingUserId;

	let userId: string | null = uidParam || null;

	if (!userId && verified.email) {
		const existingUser = await getUserByEmail(db, verified.email);
		if (existingUser) userId = existingUser.id;
	}

	if (!userId) {
		const newUser = await createUser(db, { email: verified.email ?? null, displayName });
		userId = newUser.id;
	}

	await linkFriendToUser(db, friend.id, userId);
	return userId;
}

/** Handle attribution: save ref_code, record tracking event, auto-tag via entry route */
async function handleAttribution(
	db: D1Database,
	friendId: string,
	ref: string,
	adParams: {
		gclid: string;
		fbclid: string;
		twclid: string;
		ttclid: string;
		utmSource: string;
		utmMedium: string;
		utmCampaign: string;
	},
	userAgent: string | null,
	ipAddress: string | null,
): Promise<void> {
	// TODO: migrate to Drizzle repository (ref_code column not in Drizzle schema)
	await db.prepare("UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL").bind(ref, friendId).run();

	const route = await getEntryRouteByRefCode(db, ref);

	await recordRefTracking(db, {
		refCode: ref,
		friendId,
		entryRouteId: route?.id ?? null,
		sourceUrl: null,
		fbclid: adParams.fbclid || null,
		gclid: adParams.gclid || null,
		twclid: adParams.twclid || null,
		ttclid: adParams.ttclid || null,
		utmSource: adParams.utmSource || null,
		utmMedium: adParams.utmMedium || null,
		utmCampaign: adParams.utmCampaign || null,
		userAgent,
		ipAddress,
	});

	if (route?.tag_id) {
		await addTagToFriend(db, friendId, route.tag_id);
	}
}

/** Save ad click IDs and UTM params into friend metadata */
async function saveAdMetadata(
	drizzleDb: Database,
	friendId: string,
	adParams: {
		gclid: string;
		fbclid: string;
		twclid: string;
		ttclid: string;
		utmSource: string;
		utmMedium: string;
		utmCampaign: string;
	},
): Promise<void> {
	const adMeta: Record<string, string> = {};
	if (adParams.gclid) adMeta.gclid = adParams.gclid;
	if (adParams.fbclid) adMeta.fbclid = adParams.fbclid;
	if (adParams.twclid) adMeta.twclid = adParams.twclid;
	if (adParams.ttclid) adMeta.ttclid = adParams.ttclid;
	if (adParams.utmSource) adMeta.utm_source = adParams.utmSource;
	if (adParams.utmMedium) adMeta.utm_medium = adParams.utmMedium;
	if (adParams.utmCampaign) adMeta.utm_campaign = adParams.utmCampaign;

	if (Object.keys(adMeta).length === 0) return;

	const [existingMeta] = await drizzleDb
		.select({ metadata: friends.metadata })
		.from(friends)
		.where(eq(friends.id, friendId));
	const merged = { ...JSON.parse(existingMeta?.metadata || "{}"), ...adMeta };
	await drizzleDb
		.update(friends)
		.set({ metadata: JSON.stringify(merged), updatedAt: DateTime.now().toISO() })
		.where(eq(friends.id, friendId));
}

/** Resolve X Harness token and link X username to friend metadata */
async function handleXHarnessRef(
	drizzleDb: Database,
	friendId: string,
	ref: string,
	env: { X_HARNESS_URL?: string },
): Promise<void> {
	if (!ref.startsWith("xh:")) return;
	try {
		const xhToken = ref.slice(3);
		const xhResult = await resolveXHarnessToken(xhToken, env);
		if (xhResult?.xUsername) {
			const [existingMeta] = await drizzleDb
				.select({ metadata: friends.metadata })
				.from(friends)
				.where(eq(friends.id, friendId));
			const meta = JSON.parse(existingMeta?.metadata || "{}");
			meta.x_username = xhResult.xUsername;
			await drizzleDb
				.update(friends)
				.set({ metadata: JSON.stringify(meta), updatedAt: DateTime.now().toISO() })
				.where(eq(friends.id, friendId));
			console.log(`X Harness: linked @${xhResult.xUsername} to friend ${friendId}`);
		}
		if (xhResult) {
			await applyXHarnessActions(drizzleDb, friendId, xhResult);
		}
	} catch (err) {
		console.error("X Harness token resolution error (non-blocking):", err);
	}
}

/** Auto-enroll friend in friend_add scenarios with immediate first-step delivery */
async function enrollFriendAddScenariosViaOAuth(
	db: D1Database,
	drizzleDb: Database,
	scenarioRepo: ReturnType<typeof createScenarioRepository>,
	friend: { id: string; display_name?: string | null; user_id?: string | null },
	lineUserId: string,
	accountParam: string,
	defaultAccessToken: string,
	workerUrl?: string,
): Promise<void> {
	const { LineClient } = await import("@line-crm/line-sdk");
	const { buildMessage, expandVariables } = await import("../services/step-delivery.js");

	const matchedAccountId = accountParam ? ((await getLineAccountByChannelId(db, accountParam))?.id ?? null) : null;

	let accessToken = defaultAccessToken;
	if (accountParam) {
		const acct = await getLineAccountByChannelId(db, accountParam);
		if (acct) accessToken = acct.channel_access_token;
	}
	const lineClient = new LineClient(accessToken);

	const allScenarios = await scenarioRepo.list();
	for (const scenario of allScenarios) {
		const scenarioAccountMatch =
			!(scenario.lineAccountId && matchedAccountId) || scenario.lineAccountId === matchedAccountId;
		if (!(scenario.triggerType === "friend_add" && scenario.isActive && scenarioAccountMatch)) continue;

		const [existing] = await drizzleDb
			.select({ id: friendScenarios.id })
			.from(friendScenarios)
			.where(and(eq(friendScenarios.friendId, friend.id), eq(friendScenarios.scenarioId, scenario.id)));
		if (existing) continue;

		await scenarioRepo.enrollFriend(friend.id, scenario.id, null);

		const firstStep = scenario.steps[0];
		if (firstStep && firstStep.delayMinutes === 0) {
			const expandedContent = expandVariables(
				firstStep.messageContent,
				friend as { id: string; display_name: string | null; user_id: string | null },
				workerUrl,
			);
			await lineClient.pushMessage(lineUserId, [buildMessage(firstStep.messageType, expandedContent)]);
		}
	}
}

/**
 * GET /auth/callback — LINE Login callback
 *
 * Exchanges code for tokens, extracts sub (UUID), links friend.
 */
liffRoutes.get("/auth/callback", async (c) => {
	const code = c.req.query("code");
	const stateParam = c.req.query("state") || "";
	const error = c.req.query("error");

	const state = parseCallbackState(stateParam);

	if (error || !code) {
		return c.html(errorPage(error || "Authorization failed"));
	}

	try {
		const baseUrl = new URL(c.req.url).origin;
		const callbackUrl = `${baseUrl}/auth/callback`;
		const db = c.env.DB;
		const drizzleDb = c.get("db");

		const { loginChannelId, loginChannelSecret } = await resolveLoginCredentials(
			db,
			state.accountParam,
			c.env.LINE_LOGIN_CHANNEL_ID,
			c.env.LINE_LOGIN_CHANNEL_SECRET,
		);

		const tokens = await exchangeTokens(code, callbackUrl, loginChannelId, loginChannelSecret);
		if (!tokens) return c.html(errorPage("Token exchange failed"));

		const profileResult = await verifyAndFetchProfile(tokens.id_token, tokens.access_token, loginChannelId);
		if (!profileResult) return c.html(errorPage("ID token verification failed"));

		const { verified, displayName, pictureUrl } = profileResult;
		const scenarioRepo = createScenarioRepository(drizzleDb);
		const lineUserId = verified.sub;

		const friend = await upsertFriend(db, { lineUserId, displayName, pictureUrl, statusMessage: null });
		await resolveUserIdentity(db, friend, verified, state.uidParam, displayName);

		const adParams = {
			gclid: state.gclid,
			fbclid: state.fbclid,
			twclid: state.twclid,
			ttclid: state.ttclid,
			utmSource: state.utmSource,
			utmMedium: state.utmMedium,
			utmCampaign: state.utmCampaign,
		};
		if (state.ref && !state.ref.startsWith("xh:")) {
			await handleAttribution(
				db,
				friend.id,
				state.ref,
				adParams,
				c.req.header("User-Agent") || null,
				c.req.header("CF-Connecting-IP") || null,
			);
		}

		await saveAdMetadata(drizzleDb, friend.id, adParams);

		if (state.ref) {
			await handleXHarnessRef(drizzleDb, friend.id, state.ref, c.env);
		}

		try {
			await enrollFriendAddScenariosViaOAuth(
				db,
				drizzleDb,
				scenarioRepo,
				friend,
				lineUserId,
				state.accountParam,
				c.env.LINE_CHANNEL_ACCESS_TOKEN,
				c.env.WORKER_URL,
			);
		} catch (err) {
			console.error("OAuth scenario enrollment error:", err);
		}

		if (state.redirect) return c.redirect(state.redirect);

		const friendAddUrl = await resolveBotFriendAddUrl(db, state.accountParam);
		if (friendAddUrl) return c.redirect(friendAddUrl);

		return c.html(completionPage(displayName, pictureUrl, state.ref));
	} catch (err) {
		console.error("Auth callback error:", err);
		return c.html(errorPage("Internal error"));
	}
});

// ─── Existing LIFF endpoints ────────────────────────────────────

// POST /api/liff/profile - get friend by LINE userId (public, no auth)
liffRoutes.post("/api/liff/profile", async (c) => {
	try {
		const body = await c.req.json<{ lineUserId: string }>();
		if (!body.lineUserId) {
			return c.json({ success: false, error: "lineUserId is required" }, 400);
		}

		const friend = await getFriendByLineUserId(c.env.DB, body.lineUserId);
		if (!friend) {
			return c.json({ success: false, error: "Friend not found" }, 404);
		}

		return c.json({
			success: true,
			data: {
				id: friend.id,
				displayName: friend.display_name,
				isFollowing: Boolean(friend.is_following),
				userId: (friend as unknown as Record<string, unknown>).user_id ?? null,
			},
		});
	} catch (err) {
		console.error("POST /api/liff/profile error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

/** Verify an ID token by trying multiple LINE Login channel IDs (default + DB accounts) */
async function verifyIdTokenMultiChannel(
	idToken: string,
	defaultChannelId: string,
	rawDb: D1Database,
): Promise<{ sub: string; email?: string; name?: string } | null> {
	const loginChannelIds = [defaultChannelId];
	const dbAccounts = await getLineAccounts(rawDb);
	for (const acct of dbAccounts) {
		if (acct.login_channel_id && !loginChannelIds.includes(acct.login_channel_id)) {
			loginChannelIds.push(acct.login_channel_id);
		}
	}

	for (const channelId of loginChannelIds) {
		const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
		});
		if (verifyRes.ok) {
			return verifyRes.json<{ sub: string; email?: string; name?: string }>();
		}
	}
	return null;
}

/** Save ref_code and record ref tracking (first touch wins, skip xh: tokens) */
async function saveLiffRefCode(db: D1Database, friendId: string, ref: string): Promise<void> {
	// TODO: migrate to Drizzle repository (ref_code column not in Drizzle schema)
	await db.prepare("UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL").bind(ref, friendId).run();
	try {
		const route = await getEntryRouteByRefCode(db, ref);
		await recordRefTracking(db, { refCode: ref, friendId, entryRouteId: route?.id ?? null, sourceUrl: null });
	} catch {
		/* silent */
	}
}

// POST /api/liff/link - link friend to user UUID (public, verified via LINE ID token)
liffRoutes.post("/api/liff/link", async (c) => {
	try {
		const body = await c.req.json<{
			idToken: string;
			displayName?: string | null;
			ref?: string;
			existingUuid?: string;
		}>();

		if (!body.idToken) {
			return c.json({ success: false, error: "idToken is required" }, 400);
		}

		const verified = await verifyIdTokenMultiChannel(body.idToken, c.env.LINE_LOGIN_CHANNEL_ID, c.env.DB);
		if (!verified) {
			return c.json({ success: false, error: "Invalid ID token" }, 401);
		}

		const lineUserId = verified.sub;
		const email = verified.email || null;
		const db = c.env.DB;
		const drizzleDb = c.get("db");

		const friend = await getFriendByLineUserId(db, lineUserId);
		if (!friend) {
			return c.json({ success: false, error: "Friend not found" }, 404);
		}

		if ((friend as unknown as Record<string, unknown>).user_id) {
			if (body.ref && !body.ref.startsWith("xh:")) {
				await db
					.prepare("UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL")
					.bind(body.ref, friend.id)
					.run();
			}
			if (body.ref) {
				await handleXHarnessRef(drizzleDb, friend.id, body.ref, c.env);
			}
			return c.json({
				success: true,
				data: { userId: (friend as unknown as Record<string, unknown>).user_id, alreadyLinked: true },
			});
		}

		let userId: string | null = null;
		if (email) {
			const existingUser = await getUserByEmail(db, email);
			if (existingUser) userId = existingUser.id;
		}
		if (!userId) {
			const newUser = await createUser(db, { email, displayName: body.displayName || verified.name });
			userId = newUser.id;
		}

		await linkFriendToUser(db, friend.id, userId);

		if (body.ref && !body.ref.startsWith("xh:")) {
			await saveLiffRefCode(db, friend.id, body.ref);
		}
		if (body.ref) {
			await handleXHarnessRef(drizzleDb, friend.id, body.ref, c.env);
		}

		return c.json({ success: true, data: { userId, alreadyLinked: false } });
	} catch (err) {
		console.error("POST /api/liff/link error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ─── Attribution Analytics ──────────────────────────────────────

/**
 * GET /api/analytics/ref-summary — ref code analytics summary
 */
liffRoutes.get("/api/analytics/ref-summary", async (c) => {
	try {
		const db = c.env.DB;
		const drizzleDb = c.get("db");
		const friendRepo = createFriendRepository(drizzleDb);
		const lineAccountId = c.req.query("lineAccountId");
		const accountFilter = lineAccountId ? "AND f.line_account_id = ?" : "";
		const accountBinds = lineAccountId ? [lineAccountId] : [];

		// TODO: migrate to Drizzle repository (entry_routes, ref_tracking tables not in Drizzle schema)
		const rows = await db
			.prepare(
				`SELECT
          er.ref_code,
          er.name,
          COUNT(DISTINCT rt.friend_id) as friend_count,
          COUNT(rt.id) as click_count,
          MAX(rt.created_at) as latest_at
        FROM entry_routes er
        LEFT JOIN ref_tracking rt ON er.ref_code = rt.ref_code
        LEFT JOIN friends f ON f.id = rt.friend_id ${accountFilter ? `${accountFilter}` : ""}
        GROUP BY er.ref_code, er.name
        ORDER BY friend_count DESC`,
			)
			.bind(...accountBinds)
			.all<{
				ref_code: string;
				name: string;
				friend_count: number;
				click_count: number;
				latest_at: string | null;
			}>();

		const totalFriends = await friendRepo.count(lineAccountId || undefined);

		// TODO: migrate to Drizzle repository (ref_code column not in Drizzle schema)
		const refStmt = lineAccountId
			? db
					.prepare(
						`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL AND ref_code != '' AND line_account_id = ?`,
					)
					.bind(lineAccountId)
			: db.prepare(`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL AND ref_code != ''`);
		const friendsWithRefRes = await refStmt.first<{ count: number }>();

		const friendsWithRef = friendsWithRefRes?.count ?? 0;

		return c.json({
			success: true,
			data: {
				routes: (rows.results ?? []).map((r) => ({
					refCode: r.ref_code,
					name: r.name,
					friendCount: r.friend_count,
					clickCount: r.click_count,
					latestAt: r.latest_at,
				})),
				totalFriends,
				friendsWithRef,
				friendsWithoutRef: totalFriends - friendsWithRef,
			},
		});
	} catch (err) {
		console.error("GET /api/analytics/ref-summary error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

/**
 * GET /api/analytics/ref/:refCode — detailed friend list for a single ref code
 */
liffRoutes.get("/api/analytics/ref/:refCode", async (c) => {
	try {
		const db = c.env.DB;
		const refCode = c.req.param("refCode");

		// TODO: migrate to Drizzle repository (entry_routes table not in Drizzle schema)
		const routeRow = await db
			.prepare("SELECT ref_code, name FROM entry_routes WHERE ref_code = ?")
			.bind(refCode)
			.first<{ ref_code: string; name: string }>();

		if (!routeRow) {
			return c.json({ success: false, error: "Entry route not found" }, 404);
		}

		const lineAccountId = c.req.query("lineAccountId");
		const accountFilter = lineAccountId ? "AND f.line_account_id = ?" : "";
		const binds = lineAccountId ? [refCode, refCode, lineAccountId] : [refCode, refCode];

		// TODO: migrate to Drizzle repository (ref_tracking table, ref_code column not in Drizzle schema)
		const friendRows = await db
			.prepare(
				`SELECT
          f.id,
          f.display_name,
          f.ref_code,
          rt.created_at as tracked_at
        FROM friends f
        LEFT JOIN ref_tracking rt ON f.id = rt.friend_id AND rt.ref_code = ?
        WHERE f.ref_code = ? ${accountFilter}
        ORDER BY rt.created_at DESC`,
			)
			.bind(...binds)
			.all<{
				id: string;
				display_name: string;
				ref_code: string | null;
				tracked_at: string | null;
			}>();

		return c.json({
			success: true,
			data: {
				refCode: routeRow.ref_code,
				name: routeRow.name,
				friends: (friendRows.results ?? []).map((f) => ({
					id: f.id,
					displayName: f.display_name,
					trackedAt: f.tracked_at,
				})),
			},
		});
	} catch (err) {
		console.error("GET /api/analytics/ref/:refCode error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/links/wrap - wrap a URL with LIFF redirect proxy
liffRoutes.post("/api/links/wrap", async (c) => {
	try {
		const body = await c.req.json<{ url: string; ref?: string }>();
		if (!body.url) {
			return c.json({ success: false, error: "url is required" }, 400);
		}

		const liffUrl = c.env.LIFF_URL;
		if (!liffUrl) {
			return c.json({ success: false, error: "LIFF_URL not configured" }, 500);
		}

		const params = new URLSearchParams({ redirect: body.url });
		if (body.ref) {
			params.set("ref", body.ref);
		}

		const wrappedUrl = `${liffUrl}?${params.toString()}`;
		return c.json({ success: true, data: { url: wrappedUrl } });
	} catch (err) {
		console.error("POST /api/links/wrap error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ─── HTML Templates ─────────────────────────────────────────────

function _authLandingPage(liffUrl: string, oauthUrl: string): string {
	// Extract LIFF ID from URL like https://liff.line.me/{LIFF_ID}?ref=test
	const liffIdMatch = liffUrl.match(LIFF_ID_FROM_URL_PATTERN);
	const liffId = liffIdMatch ? liffIdMatch[1] : "";
	// Query string part (e.g., ?ref=test)
	const qsIndex = liffUrl.indexOf("?");
	const liffQs = qsIndex >= 0 ? liffUrl.slice(qsIndex) : "";

	// line:// scheme to force open LINE app with LIFF
	const lineSchemeUrl = `https://line.me/R/app/${liffId}${liffQs}`;

	return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE で開く</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #06C755; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); text-align: center; max-width: 400px; width: 90%; }
    .line-icon { font-size: 48px; margin-bottom: 16px; }
    h2 { font-size: 20px; color: #333; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #999; margin-bottom: 24px; }
    .btn { display: block; width: 100%; padding: 16px; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; text-decoration: none; text-align: center; cursor: pointer; transition: opacity 0.15s; font-family: inherit; }
    .btn:active { opacity: 0.85; }
    .btn-line { background: #06C755; color: #fff; margin-bottom: 12px; }
    .btn-web { background: #f5f5f5; color: #666; font-size: 13px; padding: 12px; }
    .loading { margin-top: 16px; font-size: 13px; color: #999; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="line-icon">💬</div>
    <h2>LINEで開く</h2>
    <p class="sub">LINEアプリが起動します</p>
    <a href="${escapeHtml(lineSchemeUrl)}" class="btn btn-line" id="openBtn">LINEアプリで開く</a>
    <a href="${escapeHtml(oauthUrl)}" class="btn btn-web" id="pcBtn">PCの方・LINEが開かない方</a>
    <p class="loading hidden" id="loading">LINEアプリを起動中...</p>
  </div>
  <script>
    var lineUrl = '${escapeHtml(lineSchemeUrl)}';
    var ua = navigator.userAgent.toLowerCase();
    var isMobile = /iphone|ipad|android/.test(ua);
    var isLine = /line\\//.test(ua);
    var isIOS = /iphone|ipad/.test(ua);
    var isAndroid = /android/.test(ua);

    if (isLine) {
      // Already in LINE — go to LIFF directly
      window.location.href = '${escapeHtml(liffUrl)}';
    } else if (isMobile) {
      // Mobile browser — try to open LINE app
      document.getElementById('loading').classList.remove('hidden');
      document.getElementById('openBtn').classList.add('hidden');

      // Use line.me/R/app/ which is a Universal Link (iOS) / App Link (Android)
      // This opens LINE app directly without showing browser login
      setTimeout(function() {
        window.location.href = lineUrl;
      }, 100);

      // Fallback: if LINE app doesn't open within 2s, show the button
      setTimeout(function() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('openBtn').classList.remove('hidden');
        document.getElementById('openBtn').textContent = 'もう一度試す';
      }, 2500);
    }
  </script>
</body>
</html>`;
}

function completionPage(displayName: string, pictureUrl: string | null, ref: string): string {
	return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登録完了</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; }
    .check { width: 64px; height: 64px; border-radius: 50%; background: #06C755; color: #fff; font-size: 32px; line-height: 64px; margin: 0 auto 16px; }
    h2 { font-size: 20px; color: #06C755; margin-bottom: 16px; }
    .profile { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; }
    .profile img { width: 48px; height: 48px; border-radius: 50%; }
    .profile .name { font-size: 16px; font-weight: 600; }
    .message { font-size: 14px; color: #666; line-height: 1.6; margin-top: 12px; }
    .ref { display: inline-block; margin-top: 12px; padding: 4px 12px; background: #f0f0f0; border-radius: 12px; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>登録完了！</h2>
    <div class="profile">
      ${pictureUrl ? `<img src="${pictureUrl}" alt="">` : ""}
      <p class="name">${escapeHtml(displayName)} さん</p>
    </div>
    <p class="message">ありがとうございます！<br>これからお役立ち情報をお届けします。<br>このページは閉じて大丈夫です。</p>
    ${ref ? `<p class="ref">${escapeHtml(ref)}</p>` : ""}
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
	return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; }
    h2 { font-size: 18px; color: #e53e3e; margin-bottom: 12px; }
    p { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h2>エラー</h2>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── X Harness Token Resolution ─────────────────────────────────

/**
 * Apply X Harness gate actions (tag + scenario) to a LINE friend.
 * Non-blocking — failures are logged but don't interrupt the flow.
 */
async function applyXHarnessActions(db: Database, friendId: string, result: XHarnessTokenResult): Promise<void> {
	const tagRepo = createTagRepository(db);
	const scenarioRepo = createScenarioRepository(db);

	// Add tag if specified
	if (result.tag) {
		try {
			// Find or create the tag by name
			const [tagRow] = await db.select({ id: tags.id }).from(tags).where(eq(tags.name, result.tag));
			const tagId = tagRow?.id ?? (await tagRepo.create({ name: result.tag }));
			await tagRepo.assignToFriend(friendId, tagId);
			console.log(`X Harness: added tag "${result.tag}" to friend ${friendId}`);
		} catch (err) {
			console.error(`X Harness: failed to add tag "${result.tag}":`, err);
		}
	}

	// Start scenario if specified
	if (result.scenarioId) {
		try {
			await scenarioRepo.enrollFriend(friendId, result.scenarioId, null);
			console.log(`X Harness: enrolled friend ${friendId} in scenario ${result.scenarioId}`);
		} catch (err) {
			console.error("X Harness: failed to enroll in scenario:", err);
		}
	}
}

interface XHarnessTokenResult {
	xUsername: string | null;
	tag: string | null;
	scenarioId: string | null;
}

/**
 * Resolve an X Harness token to get the linked X username + gate config (tag, scenario).
 * The token IS the secret — no Bearer auth needed on the resolve endpoint.
 */
async function resolveXHarnessToken(
	token: string,
	env: { X_HARNESS_URL?: string },
): Promise<XHarnessTokenResult | null> {
	if (!env.X_HARNESS_URL) return null;
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout — must not block login flow
		try {
			const res = await fetch(`${env.X_HARNESS_URL}/api/tokens/${token}/resolve`, {
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
			});
			if (!res.ok) return null;
			const body = (await res.json()) as { success: boolean; data?: XHarnessTokenResult };
			if (!(body.success && body.data)) return null;
			return { xUsername: body.data.xUsername, tag: body.data.tag ?? null, scenarioId: body.data.scenarioId ?? null };
		} finally {
			clearTimeout(timeoutId);
		}
	} catch {
		return null;
	}
}

export { liffRoutes };
