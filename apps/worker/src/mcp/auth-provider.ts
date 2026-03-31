// =============================================================================
// MCP OAuth 2.1 Server Provider — Drizzle ORM-backed implementation
// =============================================================================
// Implements the OAuthServerProvider interface from @modelcontextprotocol/sdk
// using Cloudflare D1 via Drizzle ORM repositories for OAuth clients,
// authorization codes, and tokens.
//
// PKCE (S256) is enforced for all authorization code flows per OAuth 2.1 spec.
// Dynamic client registration follows RFC 7591.

import { MCP_OAUTH_CONFIG } from "@line-crm/contracts";
import { type McpOauthRepository, createDb, createMcpOauthRepository, createStaffRepository } from "@line-crm/db";
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
// Crypto helpers — token generation and hashing
// ---------------------------------------------------------------------------

function generateRandomHex(bytes: number): string {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return Array.from(buf)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function sha256Hex(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function nowEpoch(): number {
	return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// D1-backed OAuth Registered Clients Store (RFC 7591)
// ---------------------------------------------------------------------------

export function createMcpClientsStore(repo: McpOauthRepository): OAuthRegisteredClientsStore {
	return {
		async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
			const row = await repo.getClient(clientId);
			if (!row) return undefined;

			return {
				client_id: row.clientId,
				client_secret: row.clientSecret ?? undefined,
				client_name: row.clientName ?? undefined,
				redirect_uris: row.redirectUris,
				grant_types: row.grantTypes,
				scope: row.scopes ?? undefined,
				client_id_issued_at: row.clientIdIssuedAt ?? undefined,
				client_secret_expires_at: row.clientSecretExpiresAt ?? undefined,
				token_endpoint_auth_method: row.tokenEndpointAuthMethod ?? undefined,
			} as OAuthClientInformationFull;
		},

		async registerClient(
			clientInfo: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
		): Promise<OAuthClientInformationFull> {
			const clientId = await repo.registerClient({
				clientName: clientInfo.client_name ?? "MCP Client",
				redirectUris: clientInfo.redirect_uris ?? [],
				grantTypes: clientInfo.grant_types ?? ["authorization_code"],
				scopes: clientInfo.scope ?? undefined,
				clientSecret: clientInfo.client_secret ?? undefined,
				tokenEndpointAuthMethod: clientInfo.token_endpoint_auth_method ?? undefined,
			});

			return {
				...clientInfo,
				client_id: clientId,
				client_id_issued_at: nowEpoch(),
			} as OAuthClientInformationFull;
		},
	};
}

// ---------------------------------------------------------------------------
// D1-backed OAuth Server Provider
// ---------------------------------------------------------------------------

export function createMcpAuthProvider(db: D1Database, env: WorkerEnv, authorizedStaffId?: string): OAuthServerProvider {
	const drizzle = createDb(db);
	const oauthRepo = createMcpOauthRepository(drizzle);
	const staffRepo = createStaffRepository(drizzle);
	const clientsStore = createMcpClientsStore(oauthRepo);

	return {
		get clientsStore(): OAuthRegisteredClientsStore {
			return clientsStore;
		},

		// -----------------------------------------------------------------------
		// authorize — Redirect to login page or issue code directly
		// -----------------------------------------------------------------------

		async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Context): Promise<void> {
			if (!authorizedStaffId) {
				throw new Error("Authorization requires an authenticated staff session");
			}
			const code = generateRandomHex(32);
			const expiresAt = nowEpoch() + MCP_OAUTH_CONFIG.authCodeExpirySecs;
			const scopes =
				params.scopes && params.scopes.length > 0 ? params.scopes.join(" ") : MCP_OAUTH_CONFIG.defaultScope;

			await oauthRepo.createAuthCode({
				code,
				clientId: client.client_id,
				codeChallenge: params.codeChallenge,
				scopes,
				redirectUri: params.redirectUri,
				expiresAt,
				staffId: authorizedStaffId,
			});

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
			const challenge = await oauthRepo.getCodeChallenge(authorizationCode);
			if (!challenge) {
				throw new Error("Authorization code not found or expired");
			}
			return challenge;
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
			const codeRow = await oauthRepo.findValidCode(authorizationCode, client.client_id);
			if (!codeRow) {
				throw new Error("Invalid or expired authorization code");
			}

			await oauthRepo.deleteCode(authorizationCode);

			const accessToken = `mcp_at_${generateRandomHex(32)}`;
			const refreshToken = `mcp_rt_${generateRandomHex(32)}`;
			const now = nowEpoch();
			const accessExpiresAt = now + MCP_OAUTH_CONFIG.accessTokenExpirySecs;
			const refreshExpiresAt = now + MCP_OAUTH_CONFIG.refreshTokenExpirySecs;

			const accessHash = await sha256Hex(accessToken);
			const refreshHash = await sha256Hex(refreshToken);

			await oauthRepo.insertTokenPair({
				accessTokenHash: accessHash,
				refreshTokenHash: refreshHash,
				clientId: client.client_id,
				scopes: codeRow.scopes,
				staffId: codeRow.staffId,
				accessTokenExpiresAt: accessExpiresAt,
				refreshTokenExpiresAt: refreshExpiresAt,
			});

			return {
				access_token: accessToken,
				token_type: "Bearer",
				expires_in: MCP_OAUTH_CONFIG.accessTokenExpirySecs,
				scope: codeRow.scopes,
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
			const tokenRow = await oauthRepo.findValidRefreshToken(refreshToken);
			if (!tokenRow || tokenRow.clientId !== client.client_id) {
				throw new Error("Invalid or expired refresh token");
			}

			const originalScopes = tokenRow.scopes;
			const grantedScopes = scopes && scopes.length > 0 ? scopes.join(" ") : originalScopes;

			const newAccessToken = `mcp_at_${generateRandomHex(32)}`;
			const accessExpiresAt = nowEpoch() + MCP_OAUTH_CONFIG.accessTokenExpirySecs;
			const accessHash = await sha256Hex(newAccessToken);

			await oauthRepo.insertToken({
				tokenHash: accessHash,
				tokenType: "access",
				clientId: client.client_id,
				scopes: grantedScopes,
				expiresAt: accessExpiresAt,
				staffId: tokenRow.staffId,
			});

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
				const row = await oauthRepo.findValidAccessToken(token);
				if (row) {
					return {
						token,
						clientId: row.clientId,
						scopes: (row.scopes || "").split(" ").filter(Boolean),
						expiresAt: row.expiresAt,
					};
				}
			}

			// Strategy 2: Check staff API key via repository
			const staffRow = await staffRepo.findByApiKey(token);
			if (staffRow) {
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
			await oauthRepo.revokeToken(request.token);
		},
	};
}

// ---------------------------------------------------------------------------
// Helper: map staff role to OAuth scopes
// ---------------------------------------------------------------------------

function mapStaffRoleToScopes(role: string): string[] {
	switch (role) {
		case "owner":
		case "admin":
			return ["read", "write", "admin"];
		case "staff":
			return ["read", "write"];
		default:
			return ["read"];
	}
}
