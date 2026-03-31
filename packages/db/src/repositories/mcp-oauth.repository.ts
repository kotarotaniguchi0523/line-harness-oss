// =============================================================================
// MCP OAuth Repository - Drizzle ORM
// =============================================================================

import { and, eq, gt, type InferSelectModel } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { mcpOauthClients, mcpOauthCodes, mcpOauthTokens } from "../schema/index.js";
import { DateTime } from "../utils.js";

// ---------------------------------------------------------------------------
// Public types — inferred from Drizzle schema
// ---------------------------------------------------------------------------

export type McpOauthClient = InferSelectModel<typeof mcpOauthClients>;
export type McpOauthCode = InferSelectModel<typeof mcpOauthCodes>;
export type McpOauthToken = InferSelectModel<typeof mcpOauthTokens>;

/** Client with parsed JSON fields */
export interface McpOauthClientParsed extends Omit<McpOauthClient, "redirectUris" | "grantTypes"> {
	redirectUris: string[];
	grantTypes: string[];
}

export interface RegisterClientInput {
	clientName: string;
	redirectUris: string[];
	grantTypes?: string[];
	scopes?: string;
	clientSecret?: string;
	tokenEndpointAuthMethod?: string;
}

export interface CreateAuthCodeInput {
	code: string;
	clientId: string;
	codeChallenge: string;
	scopes: string;
	redirectUri: string;
	expiresAt: number;
	staffId?: string;
}

export interface InsertTokenPairInput {
	accessTokenHash: string;
	refreshTokenHash: string;
	clientId: string;
	scopes: string;
	staffId?: string | null;
	accessTokenExpiresAt: number;
	refreshTokenExpiresAt: number;
}

export interface InsertTokenInput {
	tokenHash: string;
	tokenType: "access" | "refresh";
	clientId: string;
	scopes: string;
	staffId?: string | null;
	expiresAt: number;
}

/** Repository interface for MCP OAuth operations */
export interface McpOauthRepository {
	// Client Store
	getClient(clientId: string): Promise<McpOauthClientParsed | undefined>;
	registerClient(data: RegisterClientInput): Promise<string>;

	// Authorization Codes
	createAuthCode(data: CreateAuthCodeInput): Promise<void>;
	findValidCode(code: string, clientId: string): Promise<McpOauthCode | undefined>;
	getCodeChallenge(code: string): Promise<string | undefined>;
	deleteCode(code: string): Promise<void>;

	// Tokens
	insertTokenPair(data: InsertTokenPairInput): Promise<void>;
	insertToken(data: InsertTokenInput): Promise<void>;
	findValidAccessToken(token: string): Promise<McpOauthToken | undefined>;
	findValidRefreshToken(token: string): Promise<McpOauthToken | undefined>;
	revokeToken(token: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
	const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function nowEpoch(): number {
	return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Repository factory
// ---------------------------------------------------------------------------

export function createMcpOauthRepository(db: Database): McpOauthRepository {
	return {
		// -------------------------------------------------------------------------
		// Client Store
		// -------------------------------------------------------------------------

		async getClient(clientId) {
			const [row] = await db
				.select()
				.from(mcpOauthClients)
				.where(eq(mcpOauthClients.clientId, clientId));
			if (!row) return undefined;
			return {
				...row,
				redirectUris: JSON.parse(row.redirectUris) as string[],
				grantTypes: JSON.parse(row.grantTypes) as string[],
			};
		},

		async registerClient(data) {
			const clientId = crypto.randomUUID();
			const now = nowEpoch();
			await db.insert(mcpOauthClients).values({
				clientId,
				clientName: data.clientName,
				redirectUris: JSON.stringify(data.redirectUris),
				grantTypes: JSON.stringify(data.grantTypes ?? ["authorization_code"]),
				scopes: data.scopes ?? null,
				clientSecret: data.clientSecret ?? null,
				tokenEndpointAuthMethod: data.tokenEndpointAuthMethod ?? null,
				clientIdIssuedAt: now,
			});
			return clientId;
		},

		// -------------------------------------------------------------------------
		// Authorization Codes
		// -------------------------------------------------------------------------

		async createAuthCode(data) {
			await db.insert(mcpOauthCodes).values({
				code: data.code,
				clientId: data.clientId,
				codeChallenge: data.codeChallenge,
				scopes: data.scopes,
				redirectUri: data.redirectUri,
				expiresAt: data.expiresAt,
				staffId: data.staffId ?? null,
			});
		},

		async findValidCode(code, clientId) {
			const now = nowEpoch();
			const [row] = await db
				.select()
				.from(mcpOauthCodes)
				.where(
					and(
						eq(mcpOauthCodes.code, code),
						eq(mcpOauthCodes.clientId, clientId),
						gt(mcpOauthCodes.expiresAt, now),
					),
				);
			return row ?? undefined;
		},

		async getCodeChallenge(code) {
			const now = nowEpoch();
			const [row] = await db
				.select()
				.from(mcpOauthCodes)
				.where(and(eq(mcpOauthCodes.code, code), gt(mcpOauthCodes.expiresAt, now)));
			return row?.codeChallenge;
		},

		async deleteCode(code) {
			await db.delete(mcpOauthCodes).where(eq(mcpOauthCodes.code, code));
		},

		// -------------------------------------------------------------------------
		// Tokens
		// -------------------------------------------------------------------------

		async insertTokenPair(data) {
			// biome-ignore lint/suspicious/noExplicitAny: D1 batch requires any[]
			await (db as any).batch([
				db.insert(mcpOauthTokens).values({
					tokenHash: data.accessTokenHash,
					tokenType: "access",
					clientId: data.clientId,
					scopes: data.scopes,
					expiresAt: data.accessTokenExpiresAt,
					staffId: data.staffId ?? null,
					isRevoked: false,
				}),
				db.insert(mcpOauthTokens).values({
					tokenHash: data.refreshTokenHash,
					tokenType: "refresh",
					clientId: data.clientId,
					scopes: data.scopes,
					expiresAt: data.refreshTokenExpiresAt,
					staffId: data.staffId ?? null,
					isRevoked: false,
				}),
			]);
		},

		async insertToken(data) {
			await db.insert(mcpOauthTokens).values({
				tokenHash: data.tokenHash,
				tokenType: data.tokenType,
				clientId: data.clientId,
				scopes: data.scopes,
				expiresAt: data.expiresAt,
				staffId: data.staffId ?? null,
				isRevoked: false,
			});
		},

		async findValidAccessToken(token) {
			const hash = await sha256Hex(token);
			const now = nowEpoch();
			const [row] = await db
				.select()
				.from(mcpOauthTokens)
				.where(
					and(
						eq(mcpOauthTokens.tokenHash, hash),
						eq(mcpOauthTokens.tokenType, "access"),
						eq(mcpOauthTokens.isRevoked, false),
						gt(mcpOauthTokens.expiresAt, now),
					),
				);
			return row ?? undefined;
		},

		async findValidRefreshToken(token) {
			const hash = await sha256Hex(token);
			const now = nowEpoch();
			const [row] = await db
				.select()
				.from(mcpOauthTokens)
				.where(
					and(
						eq(mcpOauthTokens.tokenHash, hash),
						eq(mcpOauthTokens.tokenType, "refresh"),
						eq(mcpOauthTokens.isRevoked, false),
						gt(mcpOauthTokens.expiresAt, now),
					),
				);
			return row ?? undefined;
		},

		async revokeToken(token) {
			const hash = await sha256Hex(token);
			await db
				.update(mcpOauthTokens)
				.set({ isRevoked: true, updatedAt: DateTime.now().toISO() })
				.where(eq(mcpOauthTokens.tokenHash, hash));
		},
	};
}
