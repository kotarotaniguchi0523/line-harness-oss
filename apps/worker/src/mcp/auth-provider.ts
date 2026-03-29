// =============================================================================
// MCP OAuth 2.1 Server Provider — D1-backed implementation
// =============================================================================
// Implements the OAuthServerProvider interface from @modelcontextprotocol/sdk
// using Cloudflare D1 as the persistence layer for OAuth clients, authorization
// codes, and tokens. Supports both staff API key and environment-level API_KEY
// for token verification (backward compatible with the previous Bearer auth).
//
// PKCE (S256) is enforced for all authorization code flows per OAuth 2.1 spec.
// Dynamic client registration follows RFC 7591.

import { MCP_OAUTH_CONFIG } from "@line-crm/contracts";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
	OAuthClientInformationFull,
	OAuthTokenRevocationRequest,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Context } from "hono";
import type { Env } from "../index.js";

// ---------------------------------------------------------------------------
// Types — Worker environment bindings subset needed by the provider
// ---------------------------------------------------------------------------

type WorkerEnv = Env["Bindings"];

// ---------------------------------------------------------------------------
// Crypto helpers — token generation and hashing for D1 storage
// ---------------------------------------------------------------------------

/** Generate a cryptographically random hex string of the given byte length */
function generateRandomHex(bytes: number): string {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return Array.from(buf)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** SHA-256 hash a string and return the hex digest for secure token storage */
async function sha256Hex(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Current time as epoch seconds */
function nowEpoch(): number {
	return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// D1-backed OAuth Registered Clients Store (RFC 7591)
// ---------------------------------------------------------------------------

/**
 * Creates an OAuthRegisteredClientsStore backed by Cloudflare D1.
 * Handles dynamic client registration and lookup for the MCP OAuth flow.
 *
 * @param db - D1 database binding from the Worker environment
 * @returns OAuthRegisteredClientsStore implementation
 */
export function createMcpClientsStore(db: D1Database): OAuthRegisteredClientsStore {
	return {
		async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
			const row = await db
				.prepare("SELECT * FROM mcp_oauth_clients WHERE client_id = ?")
				.bind(clientId)
				.first<Record<string, unknown>>();

			if (!row) return undefined;

			return {
				client_id: row.client_id as string,
				client_secret: (row.client_secret as string) ?? undefined,
				client_name: (row.client_name as string) ?? undefined,
				redirect_uris: JSON.parse((row.redirect_uris as string) || "[]"),
				grant_types: JSON.parse((row.grant_types as string) || '["authorization_code"]'),
				scope: (row.scopes as string) ?? undefined,
				client_id_issued_at: (row.client_id_issued_at as number) ?? undefined,
				client_secret_expires_at: (row.client_secret_expires_at as number) ?? undefined,
				token_endpoint_auth_method: (row.token_endpoint_auth_method as string) ?? undefined,
			} as OAuthClientInformationFull;
		},

		async registerClient(
			clientInfo: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
		): Promise<OAuthClientInformationFull> {
			const clientId = crypto.randomUUID();
			const clientIdIssuedAt = nowEpoch();
			const now = new Date().toISOString();

			const redirectUris = JSON.stringify(clientInfo.redirect_uris ?? []);
			const grantTypes = JSON.stringify(clientInfo.grant_types ?? ["authorization_code"]);

			await db
				.prepare(
					`INSERT INTO mcp_oauth_clients
           (client_id, client_secret, client_name, redirect_uris, grant_types,
            scopes, client_secret_expires_at, client_id_issued_at,
            token_endpoint_auth_method, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					clientId,
					clientInfo.client_secret ?? null,
					clientInfo.client_name ?? "MCP Client",
					redirectUris,
					grantTypes,
					clientInfo.scope ?? null,
					clientInfo.client_secret_expires_at ?? null,
					clientIdIssuedAt,
					clientInfo.token_endpoint_auth_method ?? null,
					now,
					now,
				)
				.run();

			return {
				...clientInfo,
				client_id: clientId,
				client_id_issued_at: clientIdIssuedAt,
			} as OAuthClientInformationFull;
		},
	};
}

// ---------------------------------------------------------------------------
// D1-backed OAuth Server Provider
// ---------------------------------------------------------------------------

/**
 * Creates an OAuthServerProvider that uses D1 for all persistent OAuth state.
 * Supports the full OAuth 2.1 authorization code flow with PKCE, plus
 * backward-compatible verification of staff API keys and env API_KEY.
 *
 * @param db - D1 database binding
 * @param env - Worker environment bindings (for API_KEY fallback)
 * @returns OAuthServerProvider implementation
 */
export function createMcpAuthProvider(db: D1Database, env: WorkerEnv, authorizedStaffId?: string): OAuthServerProvider {
	const clientsStore = createMcpClientsStore(db);

	return {
		get clientsStore(): OAuthRegisteredClientsStore {
			return clientsStore;
		},

		// -----------------------------------------------------------------------
		// authorize — Redirect to login page or issue code directly
		// -----------------------------------------------------------------------

		async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Context): Promise<void> {
			// Require authenticated staff — authorizedStaffId must be set by the
			// route handler after verifying the user's session (authMiddleware).
			if (!authorizedStaffId) {
				throw new Error("Authorization requires an authenticated staff session");
			}
			const code = generateRandomHex(32);
			const expiresAt = nowEpoch() + MCP_OAUTH_CONFIG.authCodeExpirySecs;
			const now = new Date().toISOString();
			const scopes =
				params.scopes && params.scopes.length > 0 ? params.scopes.join(" ") : MCP_OAUTH_CONFIG.defaultScope;

			await db
				.prepare(
					`INSERT INTO mcp_oauth_codes
           (code, client_id, code_challenge, scopes, redirect_uri, staff_id, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					code,
					client.client_id,
					params.codeChallenge,
					scopes,
					params.redirectUri,
					authorizedStaffId,
					expiresAt,
					now,
					now,
				)
				.run();

			// Build the redirect URI with authorization code and state
			const redirectUrl = new URL(params.redirectUri);
			redirectUrl.searchParams.set("code", code);
			if (params.state) {
				redirectUrl.searchParams.set("state", params.state);
			}

			return res.redirect(redirectUrl.toString(), 302) as unknown as undefined;
		},

		// -----------------------------------------------------------------------
		// challengeForAuthorizationCode — Return stored PKCE challenge
		// -----------------------------------------------------------------------

		async challengeForAuthorizationCode(
			_client: OAuthClientInformationFull,
			authorizationCode: string,
		): Promise<string> {
			const row = await db
				.prepare("SELECT code_challenge FROM mcp_oauth_codes WHERE code = ? AND expires_at > ?")
				.bind(authorizationCode, nowEpoch())
				.first<{ code_challenge: string }>();

			if (!row) {
				throw new Error("Authorization code not found or expired");
			}

			return row.code_challenge;
		},

		// -----------------------------------------------------------------------
		// exchangeAuthorizationCode — Issue access + refresh tokens
		// -----------------------------------------------------------------------

		async exchangeAuthorizationCode(
			client: OAuthClientInformationFull,
			authorizationCode: string,
			_codeVerifier?: string,
			_redirectUri?: string,
		): Promise<OAuthTokens> {
			// Look up the authorization code
			const codeRow = await db
				.prepare("SELECT * FROM mcp_oauth_codes WHERE code = ? AND client_id = ? AND expires_at > ?")
				.bind(authorizationCode, client.client_id, nowEpoch())
				.first<Record<string, unknown>>();

			if (!codeRow) {
				throw new Error("Invalid or expired authorization code");
			}

			// Delete the code (one-time use per OAuth 2.1 spec)
			await db.prepare("DELETE FROM mcp_oauth_codes WHERE code = ?").bind(authorizationCode).run();

			// Generate access and refresh tokens
			const accessToken = `mcp_at_${generateRandomHex(32)}`;
			const refreshToken = `mcp_rt_${generateRandomHex(32)}`;
			const now = nowEpoch();
			const nowIso = new Date().toISOString();
			const accessExpiresAt = now + MCP_OAUTH_CONFIG.accessTokenExpirySecs;
			const refreshExpiresAt = now + MCP_OAUTH_CONFIG.refreshTokenExpirySecs;
			const scopes = codeRow.scopes as string;
			const staffId = (codeRow.staff_id as string) ?? null;

			// Store both tokens (hashed for security)
			const accessHash = await sha256Hex(accessToken);
			const refreshHash = await sha256Hex(refreshToken);

			await db.batch([
				db
					.prepare(
						`INSERT INTO mcp_oauth_tokens
             (token_hash, token_type, client_id, scopes, expires_at, staff_id, is_revoked, created_at, updated_at)
             VALUES (?, 'access', ?, ?, ?, ?, 0, ?, ?)`,
					)
					.bind(accessHash, client.client_id, scopes, accessExpiresAt, staffId, nowIso, nowIso),
				db
					.prepare(
						`INSERT INTO mcp_oauth_tokens
             (token_hash, token_type, client_id, scopes, expires_at, staff_id, is_revoked, created_at, updated_at)
             VALUES (?, 'refresh', ?, ?, ?, ?, 0, ?, ?)`,
					)
					.bind(refreshHash, client.client_id, scopes, refreshExpiresAt, staffId, nowIso, nowIso),
			]);

			return {
				access_token: accessToken,
				token_type: "Bearer",
				expires_in: MCP_OAUTH_CONFIG.accessTokenExpirySecs,
				scope: scopes,
				refresh_token: refreshToken,
			};
		},

		// -----------------------------------------------------------------------
		// exchangeRefreshToken — Issue a new access token from a refresh token
		// -----------------------------------------------------------------------

		async exchangeRefreshToken(
			client: OAuthClientInformationFull,
			refreshToken: string,
			scopes?: string[],
		): Promise<OAuthTokens> {
			const refreshHash = await sha256Hex(refreshToken);

			const tokenRow = await db
				.prepare(
					`SELECT * FROM mcp_oauth_tokens
           WHERE token_hash = ? AND token_type = 'refresh'
             AND client_id = ? AND is_revoked = 0 AND expires_at > ?`,
				)
				.bind(refreshHash, client.client_id, nowEpoch())
				.first<Record<string, unknown>>();

			if (!tokenRow) {
				throw new Error("Invalid or expired refresh token");
			}

			// Determine scopes: use requested scopes if subset of original, else original
			const originalScopes = tokenRow.scopes as string;
			const grantedScopes = scopes && scopes.length > 0 ? scopes.join(" ") : originalScopes;

			// Generate a new access token
			const newAccessToken = `mcp_at_${generateRandomHex(32)}`;
			const now = nowEpoch();
			const nowIso = new Date().toISOString();
			const accessExpiresAt = now + MCP_OAUTH_CONFIG.accessTokenExpirySecs;
			const accessHash = await sha256Hex(newAccessToken);
			const staffId = (tokenRow.staff_id as string) ?? null;

			await db
				.prepare(
					`INSERT INTO mcp_oauth_tokens
           (token_hash, token_type, client_id, scopes, expires_at, staff_id, is_revoked, created_at, updated_at)
           VALUES (?, 'access', ?, ?, ?, ?, 0, ?, ?)`,
				)
				.bind(accessHash, client.client_id, grantedScopes, accessExpiresAt, staffId, nowIso, nowIso)
				.run();

			return {
				access_token: newAccessToken,
				token_type: "Bearer",
				expires_in: MCP_OAUTH_CONFIG.accessTokenExpirySecs,
				scope: grantedScopes,
				refresh_token: refreshToken,
			};
		},

		// -----------------------------------------------------------------------
		// verifyAccessToken — Verify Bearer token (OAuth token or staff API key)
		// -----------------------------------------------------------------------

		async verifyAccessToken(token: string): Promise<AuthInfo> {
			// Strategy 1: Check if it's an OAuth-issued access token
			if (token.startsWith("mcp_at_")) {
				const tokenHash = await sha256Hex(token);
				const row = await db
					.prepare(
						`SELECT * FROM mcp_oauth_tokens
             WHERE token_hash = ? AND token_type = 'access'
               AND is_revoked = 0 AND expires_at > ?`,
					)
					.bind(tokenHash, nowEpoch())
					.first<Record<string, unknown>>();

				if (row) {
					return {
						token,
						clientId: row.client_id as string,
						scopes: ((row.scopes as string) || "").split(" ").filter(Boolean),
						expiresAt: row.expires_at as number,
					};
				}
			}

			// Strategy 2: Check staff API key in D1 (backward compat)
			const staffRow = await db
				.prepare("SELECT id, role FROM staff_members WHERE api_key = ? AND is_active = 1")
				.bind(token)
				.first<{ id: string; role: string }>();

			if (staffRow) {
				// Map staff role to OAuth scopes for consistent authorization
				const roleScopes = mapStaffRoleToScopes(staffRow.role);
				return {
					token,
					clientId: `staff:${staffRow.id}`,
					scopes: roleScopes,
					extra: { staffId: staffRow.id, staffRole: staffRow.role },
				};
			}

			// Strategy 3: Match against environment-level owner API key
			if (token === env.API_KEY) {
				return {
					token,
					clientId: "env:owner",
					scopes: [...MCP_OAUTH_CONFIG.scopesSupported],
					extra: { authMethod: "env_api_key" },
				};
			}

			throw new Error("Invalid or expired access token");
		},

		// -----------------------------------------------------------------------
		// revokeToken — Revoke an access or refresh token
		// -----------------------------------------------------------------------

		async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
			const tokenHash = await sha256Hex(request.token);
			const nowIso = new Date().toISOString();

			// Soft-revoke: mark as revoked rather than deleting for audit trail
			await db
				.prepare("UPDATE mcp_oauth_tokens SET is_revoked = 1, updated_at = ? WHERE token_hash = ?")
				.bind(nowIso, tokenHash)
				.run();
		},
	};
}

// ---------------------------------------------------------------------------
// Helper: map staff role to OAuth scopes
// ---------------------------------------------------------------------------

/**
 * Maps a staff member's role to the corresponding set of MCP OAuth scopes.
 * Owner and admin get full access; staff members get read-only by default.
 */
function mapStaffRoleToScopes(role: string): string[] {
	switch (role) {
		case "owner":
			return ["read", "write", "admin"];
		case "admin":
			return ["read", "write", "admin"];
		case "staff":
			return ["read", "write"];
		default:
			return ["read"];
	}
}
