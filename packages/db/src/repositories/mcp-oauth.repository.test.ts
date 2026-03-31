import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcpOauthClients, mcpOauthCodes, mcpOauthTokens } from "../schema/index.js";
import { createMcpOauthRepository } from "./mcp-oauth.repository.js";

vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof import("drizzle-orm")>();
	return {
		...actual,
		eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
		and: vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions })),
		gt: vi.fn((left: unknown, right: unknown) => ({ kind: "gt", left, right })),
	};
});

function createSelectWhereChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(result),
	};
}

function createInsertValuesChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

function createInsertBatchValuesChain() {
	return {
		values: vi.fn().mockReturnValue({ _batchItem: true }),
	};
}

function createUpdateSetWhereChain() {
	return {
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

function createDeleteWhereChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

function buildClient(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		clientId: "client-1",
		clientSecret: null,
		clientName: "Test Client",
		redirectUris: '["https://example.com/callback"]',
		grantTypes: '["authorization_code"]',
		scopes: "read write",
		clientSecretExpiresAt: null,
		clientIdIssuedAt: 1700000000,
		tokenEndpointAuthMethod: "none",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function buildCode(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		code: "auth-code-1",
		clientId: "client-1",
		codeChallenge: "challenge-abc",
		scopes: "read",
		redirectUri: "https://example.com/callback",
		expiresAt: 9999999999,
		staffId: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function buildToken(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		tokenHash: "hash-abc",
		tokenType: "access",
		clientId: "client-1",
		scopes: "read",
		expiresAt: 9999999999,
		staffId: null,
		isRevoked: false,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("McpOauthRepository", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	// =============================================================================
	// Client Store
	// =============================================================================

	describe("getClient", () => {
		it("mcpOauth_getClient_existingId_shouldReturnClient", async () => {
			const row = buildClient();
			const chain = createSelectWhereChain([row]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.getClient("client-1");

			expect(result).not.toBeUndefined();
			expect(result?.clientId).toBe("client-1");
			expect(result?.clientName).toBe("Test Client");
			// JSON.parse applied to jsonText fields
			expect(result?.redirectUris).toEqual(["https://example.com/callback"]);
			expect(result?.grantTypes).toEqual(["authorization_code"]);
			expect(db.select).toHaveBeenCalledTimes(1);
			expect(chain.where).toHaveBeenCalledWith(
				expect.objectContaining({ kind: "eq", left: mcpOauthClients.clientId, right: "client-1" }),
			);
		});

		it("mcpOauth_getClient_unknownId_shouldReturnUndefined", async () => {
			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.getClient("unknown");

			expect(result).toBeUndefined();
		});
	});

	describe("registerClient", () => {
		it("mcpOauth_registerClient_validData_shouldInsertAndReturnClientId", async () => {
			const insertChain = createInsertValuesChain();
			const db = { insert: vi.fn().mockReturnValueOnce(insertChain) };
			vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("new-client-id") });
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.registerClient({
				clientName: "My App",
				redirectUris: ["https://myapp.example/cb"],
			});

			expect(result).toBe("new-client-id");
			expect(db.insert).toHaveBeenCalledWith(mcpOauthClients);
			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					clientId: "new-client-id",
					clientName: "My App",
				}),
			);
		});

		it("mcpOauth_registerClient_withAllFields_shouldStoreRedirectUrisAsJson", async () => {
			const insertChain = createInsertValuesChain();
			const db = { insert: vi.fn().mockReturnValueOnce(insertChain) };
			vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("client-xyz") });
			const repo = createMcpOauthRepository(db as never);

			await repo.registerClient({
				clientName: "Full App",
				redirectUris: ["https://app.example/cb1", "https://app.example/cb2"],
				grantTypes: ["authorization_code", "refresh_token"],
				scopes: "read write",
				tokenEndpointAuthMethod: "none",
			});

			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					redirectUris: JSON.stringify(["https://app.example/cb1", "https://app.example/cb2"]),
					grantTypes: JSON.stringify(["authorization_code", "refresh_token"]),
					scopes: "read write",
					tokenEndpointAuthMethod: "none",
				}),
			);
		});
	});

	// =============================================================================
	// Authorization Codes
	// =============================================================================

	describe("createAuthCode", () => {
		it("mcpOauth_createAuthCode_validData_shouldInsertWithExpiresAt", async () => {
			const insertChain = createInsertValuesChain();
			const db = { insert: vi.fn().mockReturnValueOnce(insertChain) };
			const repo = createMcpOauthRepository(db as never);

			await repo.createAuthCode({
				code: "code-abc",
				clientId: "client-1",
				codeChallenge: "challenge-xyz",
				scopes: "read",
				redirectUri: "https://example.com/cb",
				expiresAt: 1700001000,
				staffId: "staff-1",
			});

			expect(db.insert).toHaveBeenCalledWith(mcpOauthCodes);
			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					code: "code-abc",
					clientId: "client-1",
					codeChallenge: "challenge-xyz",
					scopes: "read",
					redirectUri: "https://example.com/cb",
					expiresAt: 1700001000,
					staffId: "staff-1",
				}),
			);
		});
	});

	describe("findValidCode", () => {
		it("mcpOauth_findValidCode_validCode_shouldReturnCodeRecord", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
			const now = Math.floor(Date.now() / 1000);

			const row = buildCode();
			const chain = createSelectWhereChain([row]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidCode("auth-code-1", "client-1");

			expect(result).toEqual(row);
			expect(chain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: mcpOauthCodes.code, right: "auth-code-1" }),
						expect.objectContaining({ kind: "eq", left: mcpOauthCodes.clientId, right: "client-1" }),
						expect.objectContaining({ kind: "gt", left: mcpOauthCodes.expiresAt, right: now }),
					]),
				}),
			);
		});

		it("mcpOauth_findValidCode_expiredCode_shouldReturnUndefined", async () => {
			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidCode("expired-code", "client-1");

			expect(result).toBeUndefined();
		});

		it("mcpOauth_findValidCode_wrongClientId_shouldReturnUndefined", async () => {
			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidCode("auth-code-1", "wrong-client");

			expect(result).toBeUndefined();
		});
	});

	describe("getCodeChallenge", () => {
		it("mcpOauth_getCodeChallenge_validCode_shouldReturnChallenge", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
			const now = Math.floor(Date.now() / 1000);

			const row = buildCode({ codeChallenge: "challenge-xyz" });
			const chain = createSelectWhereChain([row]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.getCodeChallenge("auth-code-1");

			expect(result).toBe("challenge-xyz");
			expect(chain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: mcpOauthCodes.code, right: "auth-code-1" }),
						expect.objectContaining({ kind: "gt", left: mcpOauthCodes.expiresAt, right: now }),
					]),
				}),
			);
		});

		it("mcpOauth_getCodeChallenge_expired_shouldReturnUndefined", async () => {
			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.getCodeChallenge("expired-code");

			expect(result).toBeUndefined();
		});
	});

	describe("deleteCode", () => {
		it("mcpOauth_deleteCode_existingCode_shouldDelete", async () => {
			const deleteChain = createDeleteWhereChain();
			const db = { delete: vi.fn().mockReturnValueOnce(deleteChain) };
			const repo = createMcpOauthRepository(db as never);

			await repo.deleteCode("auth-code-1");

			expect(db.delete).toHaveBeenCalledWith(mcpOauthCodes);
			expect(deleteChain.where).toHaveBeenCalledWith(
				expect.objectContaining({ kind: "eq", left: mcpOauthCodes.code, right: "auth-code-1" }),
			);
		});
	});

	// =============================================================================
	// Tokens
	// =============================================================================

	describe("insertTokenPair", () => {
		it("mcpOauth_insertTokenPair_validData_shouldInsertAccessAndRefreshTokens", async () => {
			const batchChain1 = createInsertBatchValuesChain();
			const batchChain2 = createInsertBatchValuesChain();
			const db = {
				insert: vi.fn().mockReturnValueOnce(batchChain1).mockReturnValueOnce(batchChain2),
				batch: vi.fn().mockResolvedValue([undefined, undefined]),
			};
			const repo = createMcpOauthRepository(db as never);

			await repo.insertTokenPair({
				accessTokenHash: "access-hash-hex",
				refreshTokenHash: "refresh-hash-hex",
				clientId: "client-1",
				scopes: "read",
				accessTokenExpiresAt: 1700001000,
				refreshTokenExpiresAt: 1700604800,
			});

			expect(db.batch).toHaveBeenCalledTimes(1);
			expect(batchChain1.values).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenHash: "access-hash-hex",
					tokenType: "access",
					clientId: "client-1",
					scopes: "read",
					expiresAt: 1700001000,
				}),
			);
			expect(batchChain2.values).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenHash: "refresh-hash-hex",
					tokenType: "refresh",
					clientId: "client-1",
					scopes: "read",
					expiresAt: 1700604800,
				}),
			);
		});
	});

	describe("findValidAccessToken", () => {
		it("mcpOauth_findValidAccessToken_valid_shouldReturnToken", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
			const now = Math.floor(Date.now() / 1000);

			const mockHashBuffer = new Uint8Array(32).fill(0xaa).buffer;
			const expectedHashHex = Array.from(new Uint8Array(32).fill(0xaa))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			vi.stubGlobal("crypto", {
				subtle: { digest: vi.fn().mockResolvedValue(mockHashBuffer) },
			});

			const row = buildToken({ tokenHash: expectedHashHex, tokenType: "access" });
			const chain = createSelectWhereChain([row]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidAccessToken("plain-token");

			expect(result).toEqual(row);
			expect(chain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: mcpOauthTokens.tokenHash, right: expectedHashHex }),
						expect.objectContaining({ kind: "eq", left: mcpOauthTokens.tokenType, right: "access" }),
						expect.objectContaining({ kind: "eq", left: mcpOauthTokens.isRevoked, right: false }),
						expect.objectContaining({ kind: "gt", left: mcpOauthTokens.expiresAt, right: now }),
					]),
				}),
			);
		});

		it("mcpOauth_findValidAccessToken_revoked_shouldReturnUndefined", async () => {
			const mockHashBuffer = new Uint8Array(32).fill(0xaa).buffer;
			vi.stubGlobal("crypto", {
				subtle: { digest: vi.fn().mockResolvedValue(mockHashBuffer) },
			});

			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidAccessToken("revoked-token");

			expect(result).toBeUndefined();
		});

		it("mcpOauth_findValidAccessToken_expired_shouldReturnUndefined", async () => {
			const mockHashBuffer = new Uint8Array(32).fill(0xaa).buffer;
			vi.stubGlobal("crypto", {
				subtle: { digest: vi.fn().mockResolvedValue(mockHashBuffer) },
			});

			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidAccessToken("expired-token");

			expect(result).toBeUndefined();
		});
	});

	describe("findValidRefreshToken", () => {
		it("mcpOauth_findValidRefreshToken_valid_shouldReturnToken", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
			const now = Math.floor(Date.now() / 1000);

			const mockHashBuffer = new Uint8Array(32).fill(0xbb).buffer;
			const expectedHashHex = Array.from(new Uint8Array(32).fill(0xbb))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			vi.stubGlobal("crypto", {
				subtle: { digest: vi.fn().mockResolvedValue(mockHashBuffer) },
			});

			const row = buildToken({ tokenHash: expectedHashHex, tokenType: "refresh" });
			const chain = createSelectWhereChain([row]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidRefreshToken("plain-refresh-token");

			expect(result).toEqual(row);
			expect(chain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: mcpOauthTokens.tokenHash, right: expectedHashHex }),
						expect.objectContaining({ kind: "eq", left: mcpOauthTokens.tokenType, right: "refresh" }),
						expect.objectContaining({ kind: "eq", left: mcpOauthTokens.isRevoked, right: false }),
						expect.objectContaining({ kind: "gt", left: mcpOauthTokens.expiresAt, right: now }),
					]),
				}),
			);
		});

		it("mcpOauth_findValidRefreshToken_revokedOrExpired_shouldReturnUndefined", async () => {
			const mockHashBuffer = new Uint8Array(32).fill(0xbb).buffer;
			vi.stubGlobal("crypto", {
				subtle: { digest: vi.fn().mockResolvedValue(mockHashBuffer) },
			});

			const chain = createSelectWhereChain([]);
			const db = { select: vi.fn().mockReturnValueOnce(chain) };
			const repo = createMcpOauthRepository(db as never);

			const result = await repo.findValidRefreshToken("revoked-refresh-token");

			expect(result).toBeUndefined();
		});
	});

	describe("revokeToken", () => {
		it("mcpOauth_revokeToken_existingHash_shouldSetIsRevoked", async () => {
			const mockHashBuffer = new Uint8Array(32).fill(0xee).buffer;
			const expectedHashHex = Array.from(new Uint8Array(32).fill(0xee))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			vi.stubGlobal("crypto", {
				subtle: { digest: vi.fn().mockResolvedValue(mockHashBuffer) },
			});

			const updateChain = createUpdateSetWhereChain();
			const db = { update: vi.fn().mockReturnValueOnce(updateChain) };
			const repo = createMcpOauthRepository(db as never);

			await repo.revokeToken("plain-token-to-revoke");

			expect(db.update).toHaveBeenCalledWith(mcpOauthTokens);
			expect(updateChain.set).toHaveBeenCalledWith(
				expect.objectContaining({ isRevoked: true }),
			);
			const setResult = updateChain.set.mock.results[0]?.value as { where: ReturnType<typeof vi.fn> };
			expect(setResult.where).toHaveBeenCalledWith(
				expect.objectContaining({ kind: "eq", left: mcpOauthTokens.tokenHash, right: expectedHashHex }),
			);
		});
	});
});
