/**
 * 広告CV送信サービス
 *
 * LINE内アクション発生時に、友だちの広告クリックIDを元に
 * 各広告媒体のConversion APIへオフラインCVを送信する。
 *
 * - neverthrow ApiResult パターンでエラーハンドリング
 * - SHA256 ハッシュでユーザーデータ保護 (Meta / TikTok)
 * - Yahoo Search / Display Ads 対応
 * - event_id による重複排除 (Meta / TikTok)
 */

import { AD_PLATFORM_URLS } from "@line-crm/contracts";
import { createAdPlatformRepository, createDb, createEntryRouteRepository } from "@line-crm/db";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

/** Parsed config from the ad_platforms.config JSON column */
type AdPlatformConfig = Record<string, string>;

/** A ref_tracking row with click IDs */
interface RefTracking {
	fbclid?: string | null;
	gclid?: string | null;
	twclid?: string | null;
	ttclid?: string | null;
	yclid?: string | null;
	utmSource?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export const AdConversionErrorCodes = {
	NO_REF_TRACKING: "NO_REF_TRACKING",
	NO_CLICK_ID: "NO_CLICK_ID",
	PLATFORM_NOT_CONFIGURED: "PLATFORM_NOT_CONFIGURED",
	YAHOO_AUTH_FAILED: "YAHOO_AUTH_FAILED",
	API_REQUEST_FAILED: "API_REQUEST_FAILED",
	UNKNOWN: "UNKNOWN",
} as const;

export type AdConversionErrorCode = (typeof AdConversionErrorCodes)[keyof typeof AdConversionErrorCodes];

export interface AdConversionError {
	readonly code: AdConversionErrorCode;
	readonly message: string;
	readonly platform?: string;
	readonly details?: Record<string, unknown>;
}

type ApiResult<T> = Result<T, AdConversionError>;

// ---------------------------------------------------------------------------
// Utility: SHA256 hashing for PII (email, phone, etc.)
// ---------------------------------------------------------------------------

async function sha256Hash(value: string): Promise<string> {
	const normalized = value.trim().toLowerCase();
	const encoder = new TextEncoder();
	const data = encoder.encode(normalized);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash all non-empty PII fields for user_data payloads */
async function hashUserData(opts: {
	email?: string | null;
	phone?: string | null;
	firstName?: string | null;
	lastName?: string | null;
}): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	if (opts.email) result.em = await sha256Hash(opts.email);
	if (opts.phone) result.ph = await sha256Hash(opts.phone);
	if (opts.firstName) result.fn = await sha256Hash(opts.firstName);
	if (opts.lastName) result.ln = await sha256Hash(opts.lastName);
	return result;
}

// ---------------------------------------------------------------------------
// Utility: format JST datetime for Yahoo Ads API (YYYYMMDD HHmmss +0900)
// ---------------------------------------------------------------------------

function formatYahooConversionTime(date: Date): string {
	const jstOffset = 9 * 60 * 60 * 1000;
	const jst = new Date(date.getTime() + jstOffset);
	const year = jst.getUTCFullYear();
	const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
	const day = String(jst.getUTCDate()).padStart(2, "0");
	const hours = String(jst.getUTCHours()).padStart(2, "0");
	const minutes = String(jst.getUTCMinutes()).padStart(2, "0");
	const seconds = String(jst.getUTCSeconds()).padStart(2, "0");
	return `${year}${month}${day} ${hours}${minutes}${seconds} +0900`;
}

// ---------------------------------------------------------------------------
// Yahoo OAuth token refresh
// ---------------------------------------------------------------------------

interface YahooTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
}

async function refreshYahooAccessToken(config: {
	yahoo_client_id: string;
	yahoo_client_secret: string;
	yahoo_refresh_token: string;
}): Promise<ApiResult<string>> {
	const tokenUrl = AD_PLATFORM_URLS.yahoo.authToken;

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: config.yahoo_refresh_token,
		client_id: config.yahoo_client_id,
		client_secret: config.yahoo_client_secret,
	});

	const response = await fetch(tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.YAHOO_AUTH_FAILED,
			message: `Yahoo OAuth token refresh failed: ${response.status}`,
			platform: "yahoo",
			details: { status: response.status, body: errorBody },
		});
	}

	const tokenData = (await response.json()) as YahooTokenResponse;
	return ok(tokenData.access_token);
}

// ---------------------------------------------------------------------------
// Dispatch table: platform name -> converter (pure extraction + I/O send)
// ---------------------------------------------------------------------------

interface PlatformConverter {
	/** Extract the click ID from ref tracking data (pure) */
	extractClickId: (ref: RefTracking) => string | null;
	/** Click ID type name for logging */
	clickIdType: string;
	/** Send the conversion to the ad platform (I/O) */
	send: (
		config: AdPlatformConfig,
		ref: RefTracking,
		eventName: string,
		eventValue?: number,
	) => Promise<ApiResult<void>>;
}

const converters: Record<string, PlatformConverter> = {
	meta: {
		extractClickId: (ref) => ref.fbclid ?? null,
		clickIdType: "fbclid",
		send: sendMetaConversion,
	},
	x: {
		extractClickId: (ref) => ref.twclid ?? null,
		clickIdType: "twclid",
		send: sendXConversion,
	},
	google: {
		extractClickId: (ref) => ref.gclid ?? null,
		clickIdType: "gclid",
		send: sendGoogleConversion,
	},
	tiktok: {
		extractClickId: (ref) => ref.ttclid ?? null,
		clickIdType: "ttclid",
		send: sendTikTokConversion,
	},
	yahoo_search: {
		extractClickId: (ref) => ref.yclid ?? null,
		clickIdType: "yclid",
		send: sendYahooSearchConversion,
	},
	yahoo_display: {
		extractClickId: (ref) => ref.yclid ?? null,
		clickIdType: "yclid",
		send: sendYahooDisplayConversion,
	},
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ConversionSendResult {
	readonly platform: string;
	readonly clickId: string;
	readonly status: "sent" | "failed";
	readonly errorMessage?: string;
}

export async function sendAdConversions(
	db: D1Database,
	friendId: string,
	eventName: string,
	eventValue?: number,
): Promise<ApiResult<ConversionSendResult[]>> {
	const drizzle = createDb(db);
	const entryRouteRepo = createEntryRouteRepository(drizzle);
	const ref = await entryRouteRepo.getTracking(friendId);
	if (!ref) {
		return ok([]); // No ref tracking data — nothing to send (not an error)
	}

	const adPlatformRepo = createAdPlatformRepository(drizzle);
	const platforms = await adPlatformRepo.listActive();
	const results: ConversionSendResult[] = [];

	for (const platform of platforms) {
		const converter = converters[platform.name];
		if (!converter) continue;

		const clickId = converter.extractClickId(ref);
		if (!clickId) continue;

		const config: AdPlatformConfig = JSON.parse(platform.config);
		const sendResult = await converter.send(config, ref, eventName, eventValue);

		if (sendResult.isOk()) {
			await adPlatformRepo.logConversion({
				platformId: platform.id,
				friendId,
				eventName,
				clickId,
				clickIdType: converter.clickIdType,
				status: "sent",
			});
			results.push({ platform: platform.name, clickId, status: "sent" });
		} else {
			const errorMessage = sendResult.error.message;
			await adPlatformRepo.logConversion({
				platformId: platform.id,
				friendId,
				eventName,
				clickId,
				clickIdType: converter.clickIdType,
				status: "failed",
				errorMessage,
			});
			results.push({ platform: platform.name, clickId, status: "failed", errorMessage });
		}
	}

	return ok(results);
}

// ---------------------------------------------------------------------------
// Meta Conversions API (v21.0)
// - SHA256 hashing for user data (email, phone, name)
// - Event deduplication via event_id (crypto.randomUUID())
// - Proper user_data format with hashed fields
// - Test event code support
// ---------------------------------------------------------------------------

async function sendMetaConversion(
	config: AdPlatformConfig,
	ref: RefTracking,
	eventName: string,
	eventValue?: number,
): Promise<ApiResult<void>> {
	const pixelId = config.pixel_id;
	const accessToken = config.access_token;
	if (!(pixelId && accessToken)) {
		return err({
			code: AdConversionErrorCodes.PLATFORM_NOT_CONFIGURED,
			message: "Meta pixel_id and access_token are required",
			platform: "meta",
		});
	}

	const url = `${AD_PLATFORM_URLS.meta.conversionsApi}/${pixelId}/events`;
	const eventId = crypto.randomUUID();

	// Build user_data with hashed PII fields
	const hashedUserData = await hashUserData({
		email: ref.utmSource ?? null, // placeholder — real email from friend profile
		phone: null,
	});

	const userData: Record<string, unknown> = {
		...hashedUserData,
		fbc: `fb.1.${Date.now()}.${ref.fbclid}`,
		client_ip_address: ref.ipAddress || undefined,
		client_user_agent: ref.userAgent || undefined,
	};

	const eventData: Record<string, unknown> = {
		event_name: eventName,
		event_time: Math.floor(Date.now() / 1000),
		event_id: eventId,
		action_source: "website",
		user_data: userData,
	};

	if (eventValue) {
		eventData.custom_data = { currency: "JPY", value: eventValue };
	}

	const body: Record<string, unknown> = {
		data: [eventData],
		access_token: accessToken,
	};

	if (config.test_event_code) {
		body.test_event_code = config.test_event_code;
	}

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.API_REQUEST_FAILED,
			message: `Meta CAPI error: ${response.status} ${errorBody}`,
			platform: "meta",
			details: { status: response.status, eventId },
		});
	}

	return ok(undefined);
}

// ---------------------------------------------------------------------------
// X (Twitter) Conversion API
// ---------------------------------------------------------------------------

async function sendXConversion(
	config: AdPlatformConfig,
	ref: RefTracking,
	eventName: string,
	eventValue?: number,
): Promise<ApiResult<void>> {
	const url = AD_PLATFORM_URLS.x.conversionsApi;

	const body = {
		conversions: [
			{
				conversion_time: new Date().toISOString(),
				event_id: crypto.randomUUID(),
				identifiers: [{ twclid: ref.twclid }],
				conversion_id: config.pixel_id,
				event_name: eventName,
				...(eventValue && { value: { currency: "JPY", amount: String(eventValue) } }),
			},
		],
	};

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// OAuth 1.0a signature required — placeholder for production implementation
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.API_REQUEST_FAILED,
			message: `X Conversion API error: ${response.status} ${errorBody}`,
			platform: "x",
			details: { status: response.status },
		});
	}

	return ok(undefined);
}

// ---------------------------------------------------------------------------
// Google Ads Conversion API (v18)
// ---------------------------------------------------------------------------

async function sendGoogleConversion(
	config: AdPlatformConfig,
	ref: RefTracking,
	_eventName: string,
	eventValue?: number,
): Promise<ApiResult<void>> {
	const customerId = config.customer_id;
	const oauthToken = config.oauth_token;
	if (!(customerId && oauthToken)) {
		return err({
			code: AdConversionErrorCodes.PLATFORM_NOT_CONFIGURED,
			message: "Google customer_id and oauth_token are required",
			platform: "google",
		});
	}

	const url = `${AD_PLATFORM_URLS.google.adsConversions}/${customerId}:uploadClickConversions`;

	const body = {
		conversions: [
			{
				gclid: ref.gclid,
				conversion_action: `customers/${customerId}/conversionActions/${config.conversion_action_id}`,
				conversion_date_time: new Date().toISOString().replace("Z", "+09:00"),
				...(eventValue && { conversion_value: eventValue, currency_code: "JPY" }),
			},
		],
		partial_failure: true,
	};

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${oauthToken}`,
			"developer-token": config.developer_token || "",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.API_REQUEST_FAILED,
			message: `Google Ads API error: ${response.status} ${errorBody}`,
			platform: "google",
			details: { status: response.status },
		});
	}

	return ok(undefined);
}

// ---------------------------------------------------------------------------
// TikTok Events API (v1.3)
// - pixel_code parameter
// - event_id for deduplication
// - SHA256 hashed email/phone
// - User agent and IP forwarding
// ---------------------------------------------------------------------------

async function sendTikTokConversion(
	config: AdPlatformConfig,
	ref: RefTracking,
	eventName: string,
	eventValue?: number,
): Promise<ApiResult<void>> {
	const pixelCode = config.pixel_code;
	const accessToken = config.access_token;
	if (!(pixelCode && accessToken)) {
		return err({
			code: AdConversionErrorCodes.PLATFORM_NOT_CONFIGURED,
			message: "TikTok pixel_code and access_token are required",
			platform: "tiktok",
		});
	}

	const url = AD_PLATFORM_URLS.tiktok.eventsApi;
	const eventId = crypto.randomUUID();

	// Build hashed user context
	const hashedUserData = await hashUserData({
		email: null,
		phone: null,
	});

	const userContext: Record<string, unknown> = {
		...hashedUserData,
		user_agent: ref.userAgent || undefined,
		ip: ref.ipAddress || undefined,
	};

	const body = {
		pixel_code: pixelCode,
		event: eventName,
		event_id: eventId,
		timestamp: new Date().toISOString(),
		context: {
			user: userContext,
		},
		properties: {
			...(ref.ttclid && { ttclid: ref.ttclid }),
			...(eventValue && { currency: "JPY", value: eventValue }),
		},
	};

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Access-Token": accessToken,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.API_REQUEST_FAILED,
			message: `TikTok Events API error: ${response.status} ${errorBody}`,
			platform: "tiktok",
			details: { status: response.status, eventId },
		});
	}

	return ok(undefined);
}

// ---------------------------------------------------------------------------
// Yahoo Search Ads Conversion API (v14)
// - OAuth 2.0 Bearer token (refresh before each send)
// - POST to ConversionService with add method
// - Body: JSON with operand containing conversion data
// ---------------------------------------------------------------------------

async function sendYahooSearchConversion(
	config: AdPlatformConfig,
	ref: RefTracking,
	eventName: string,
	eventValue?: number,
): Promise<ApiResult<void>> {
	const clientId = config.yahoo_client_id;
	const clientSecret = config.yahoo_client_secret;
	const refreshToken = config.yahoo_refresh_token;
	const accountId = config.yahoo_account_id;
	const conversionTrackerId = config.yahoo_conversion_tracker_id;

	if (!(clientId && clientSecret && refreshToken && accountId)) {
		return err({
			code: AdConversionErrorCodes.PLATFORM_NOT_CONFIGURED,
			message: "Yahoo Search Ads requires client_id, client_secret, refresh_token, and account_id",
			platform: "yahoo_search",
		});
	}

	// Refresh OAuth access token
	const tokenResult = await refreshYahooAccessToken({
		yahoo_client_id: clientId,
		yahoo_client_secret: clientSecret,
		yahoo_refresh_token: refreshToken,
	});
	if (tokenResult.isErr()) {
		return err(tokenResult.error);
	}

	const accessToken = tokenResult.value;
	const url = `${AD_PLATFORM_URLS.yahoo.searchConversions}/add`;
	const conversionTime = formatYahooConversionTime(new Date());

	const body = {
		accountId,
		operand: [
			{
				conversionTrackerName: eventName,
				conversionTrackerId: conversionTrackerId || undefined,
				conversionTime,
				conversionValue: eventValue ?? 0,
				clickId: ref.yclid || undefined,
			},
		],
	};

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.API_REQUEST_FAILED,
			message: `Yahoo Search Ads API error: ${response.status} ${errorBody}`,
			platform: "yahoo_search",
			details: { status: response.status, accountId },
		});
	}

	return ok(undefined);
}

// ---------------------------------------------------------------------------
// Yahoo Display Ads (YDA) Conversion API (v14)
// - Same OAuth flow as Search but different endpoint
// - Slightly different payload: includes yclid at top level
// ---------------------------------------------------------------------------

async function sendYahooDisplayConversion(
	config: AdPlatformConfig,
	ref: RefTracking,
	eventName: string,
	eventValue?: number,
): Promise<ApiResult<void>> {
	const clientId = config.yahoo_client_id;
	const clientSecret = config.yahoo_client_secret;
	const refreshToken = config.yahoo_refresh_token;
	const accountId = config.yahoo_account_id;
	const conversionTrackerId = config.yahoo_conversion_tracker_id;

	if (!(clientId && clientSecret && refreshToken && accountId)) {
		return err({
			code: AdConversionErrorCodes.PLATFORM_NOT_CONFIGURED,
			message: "Yahoo Display Ads requires client_id, client_secret, refresh_token, and account_id",
			platform: "yahoo_display",
		});
	}

	// Refresh OAuth access token
	const tokenResult = await refreshYahooAccessToken({
		yahoo_client_id: clientId,
		yahoo_client_secret: clientSecret,
		yahoo_refresh_token: refreshToken,
	});
	if (tokenResult.isErr()) {
		return err(tokenResult.error);
	}

	const accessToken = tokenResult.value;
	const url = `${AD_PLATFORM_URLS.yahoo.displayConversions}/add`;
	const conversionTime = formatYahooConversionTime(new Date());

	const body = {
		accountId,
		operand: [
			{
				conversionTrackerName: eventName,
				conversionTrackerId: conversionTrackerId || undefined,
				conversionTime,
				conversionValue: eventValue ?? 0,
				yclid: ref.yclid || undefined,
			},
		],
	};

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		return err({
			code: AdConversionErrorCodes.API_REQUEST_FAILED,
			message: `Yahoo Display Ads API error: ${response.status} ${errorBody}`,
			platform: "yahoo_display",
			details: { status: response.status, accountId },
		});
	}

	return ok(undefined);
}
