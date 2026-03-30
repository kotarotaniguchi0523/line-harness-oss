// =============================================================================
// Google Calendar API client + OAuth2 Token Refresh
//
// Handles Google Calendar CRUD operations and automatic refresh of expired
// OAuth2 access tokens. Tokens are persisted in D1 via the calendar
// connection record so subsequent requests can skip the refresh.
// =============================================================================

import { createCalendarRepository, createDb } from "@line-crm/db";

/** Type inferred from the calendar connection row returned by the repository */
type GoogleCalendarConnectionRow = NonNullable<
	Awaited<ReturnType<ReturnType<typeof createCalendarRepository>["findConnectionById"]>>
>;

const GCAL_BASE = "https://www.googleapis.com/calendar/v3";
const TIMEZONE = "Asia/Tokyo";

// =============================================================================
// OAuth2 Token Refresh
// =============================================================================

/** Google OAuth2 token endpoint */
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Buffer in seconds before actual expiry to trigger a proactive refresh */
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

/** Response shape from Google's token refresh endpoint */
interface GoogleTokenRefreshResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope?: string;
}

/** Error response from Google's token endpoint */
interface GoogleTokenErrorResponse {
	error: string;
	error_description?: string;
}

/**
 * Result type for token refresh operations.
 * On success, returns the fresh access_token.
 * On failure, returns a descriptive error message.
 */
export type TokenRefreshResult = { ok: true; accessToken: string } | { ok: false; error: string };

/**
 * Determine whether the stored access_token has expired or is about to expire.
 * Returns true if:
 *  - token_expires_at is not set (unknown expiry, assume expired)
 *  - current time + buffer exceeds the stored expiry timestamp
 */
export function isTokenExpired(connection: GoogleCalendarConnectionRow): boolean {
	if (!connection.tokenExpiresAt) {
		return true;
	}
	const expiresAtMs = new Date(connection.tokenExpiresAt).getTime();
	if (Number.isNaN(expiresAtMs)) {
		return true;
	}
	const nowWithBuffer = Date.now() + TOKEN_EXPIRY_BUFFER_SECONDS * 1000;
	return nowWithBuffer >= expiresAtMs;
}

/**
 * Refresh a Google OAuth2 access_token using the stored refresh_token.
 *
 * Makes a POST request to Google's token endpoint with the
 * client credentials and refresh_token. On success, persists the
 * new access_token and its expiration in D1.
 */
export async function refreshGoogleAccessToken(
	db: D1Database,
	connectionId: string,
	clientId: string,
	clientSecret: string,
	refreshToken: string,
): Promise<TokenRefreshResult> {
	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		refresh_token: refreshToken,
		grant_type: "refresh_token",
	});

	const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	if (!res.ok) {
		const errorBody = await res.text().catch(() => "");
		let errorMessage = `Google token refresh failed with status ${res.status}`;
		try {
			const parsed = JSON.parse(errorBody) as GoogleTokenErrorResponse;
			if (parsed.error_description) {
				errorMessage = `Google token refresh error: ${parsed.error} - ${parsed.error_description}`;
			} else if (parsed.error) {
				errorMessage = `Google token refresh error: ${parsed.error}`;
			}
		} catch {
			// Could not parse error JSON — use the generic message
		}
		console.error(errorMessage, { connectionId, status: res.status });
		return { ok: false, error: errorMessage };
	}

	const data = (await res.json()) as GoogleTokenRefreshResponse;
	if (!(data.access_token && data.expires_in)) {
		const msg = "Google token refresh: response missing access_token or expires_in";
		console.error(msg, { connectionId });
		return { ok: false, error: msg };
	}

	const expiresAtMs = Date.now() + data.expires_in * 1000;
	const tokenExpiresAt = new Date(expiresAtMs).toISOString();

	const drizzle = createDb(db);
	const calendarRepo = createCalendarRepository(drizzle);
	await calendarRepo.updateTokens(connectionId, {
		accessToken: data.access_token,
		tokenExpiresAt,
	});

	return { ok: true, accessToken: data.access_token };
}

/**
 * Ensure a valid (non-expired) access_token is available for a calendar connection.
 *
 * If the current token is still valid, returns it directly.
 * If expired and a refresh_token + OAuth credentials are available, performs a refresh.
 * If no token or refresh capability exists, returns null (caller should fall back).
 */
export async function ensureValidAccessToken(
	db: D1Database,
	connection: GoogleCalendarConnectionRow,
	clientId: string | undefined,
	clientSecret: string | undefined,
): Promise<string | null> {
	if (!connection.accessToken) {
		return null;
	}

	if (!isTokenExpired(connection)) {
		return connection.accessToken;
	}

	if (!(connection.refreshToken && clientId && clientSecret)) {
		console.warn(
			"Calendar connection token expired but refresh not possible (missing refresh_token or OAuth credentials)",
			{ connectionId: connection.id },
		);
		return connection.accessToken;
	}

	const result = await refreshGoogleAccessToken(db, connection.id, clientId, clientSecret, connection.refreshToken);

	if (result.ok) {
		return result.accessToken;
	}

	console.warn("Token refresh failed, using stale token as fallback", {
		connectionId: connection.id,
		error: result.error,
	});
	return connection.accessToken;
}

// =============================================================================
// Google Calendar API Client
// =============================================================================

export interface GoogleCalendarConfig {
	calendarId: string;
	accessToken: string;
}

export interface BusyInterval {
	start: string;
	end: string;
}

export interface CreateEventInput {
	summary: string;
	start: string; // ISO datetime string
	end: string; // ISO datetime string
	description?: string;
}

export class GoogleCalendarClient {
	constructor(private config: GoogleCalendarConfig) {}

	/**
	 * Get busy time intervals from Google Calendar FreeBusy API.
	 * Returns an array of { start, end } intervals when the calendar is busy.
	 */
	async getFreeBusy(timeMin: string, timeMax: string): Promise<BusyInterval[]> {
		const url = `${GCAL_BASE}/freeBusy`;
		const body = {
			timeMin,
			timeMax,
			items: [{ id: this.config.calendarId }],
		};

		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.config.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`Google FreeBusy API error ${res.status}: ${text}`);
		}

		const data = (await res.json()) as {
			calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
		};

		const calendarData = data.calendars?.[this.config.calendarId];
		return calendarData?.busy ?? [];
	}

	/**
	 * Create an event on Google Calendar.
	 * Returns the created event's ID.
	 */
	async createEvent(event: CreateEventInput): Promise<{ eventId: string }> {
		const url = `${GCAL_BASE}/calendars/${encodeURIComponent(this.config.calendarId)}/events`;

		const body = {
			summary: event.summary,
			description: event.description,
			start: { dateTime: event.start, timeZone: TIMEZONE },
			end: { dateTime: event.end, timeZone: TIMEZONE },
		};

		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.config.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`Google Calendar createEvent error ${res.status}: ${text}`);
		}

		const data = (await res.json()) as { id?: string };
		if (!data.id) {
			throw new Error("Google Calendar createEvent: response missing event id");
		}

		return { eventId: data.id };
	}

	/**
	 * Delete an event from Google Calendar.
	 */
	async deleteEvent(eventId: string): Promise<void> {
		const url = `${GCAL_BASE}/calendars/${encodeURIComponent(this.config.calendarId)}/events/${encodeURIComponent(eventId)}`;

		const res = await fetch(url, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${this.config.accessToken}`,
			},
		});

		// 204 = success, 410 = already deleted — both are acceptable
		if (!res.ok && res.status !== 410) {
			const text = await res.text().catch(() => "");
			throw new Error(`Google Calendar deleteEvent error ${res.status}: ${text}`);
		}
	}
}
