// =============================================================================
// MCP HTTP Endpoint — OAuth 2.1 compliant Streamable HTTP transport
// =============================================================================
// Exposes the MCP (Model Context Protocol) server over HTTP with full OAuth 2.1
// authorization server support via @hono/mcp's mcpAuthRouter.
//
// Endpoints installed by mcpAuthRouter:
//   /.well-known/oauth-authorization-server — RFC 8414 metadata discovery
//   /.well-known/oauth-protected-resource   — RFC 9728 protected resource metadata
//   /authorize    — OAuth 2.1 authorization endpoint (PKCE required)
//   /token        — Token exchange (authorization_code + refresh_token grants)
//   /register     — RFC 7591 Dynamic Client Registration
//   /revoke       — RFC 7009 Token Revocation
//
// The MCP transport endpoint at /mcp uses spec-compliant Bearer token
// verification that supports OAuth-issued tokens, staff API keys, and the
// environment-level API_KEY for backward compatibility.
//
// Protocol: Streamable HTTP (SSE for GET, JSON-RPC for POST, session DELETE)
// See: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http

import { StreamableHTTPTransport } from "@hono/mcp";
import { mcpAuthRouter, bearerAuth as mcpBearerAuth } from "@hono/mcp/auth";
import { MCP_OAUTH_CONFIG } from "@line-crm/contracts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { createMcpAuthProvider } from "../mcp/auth-provider.js";
import { MCP_CONFIG } from "../mcp/config.js";
import { registerHttpMcpResources } from "../mcp/resources.js";
import { registerHttpMcpTools } from "../mcp/tools.js";

// ---------------------------------------------------------------------------
// Sub-app for MCP endpoints — mounted at root, uses path-based routing
// ---------------------------------------------------------------------------

const mcpRoute = new Hono<Env>();

// ---------------------------------------------------------------------------
// OAuth 2.1 Authorization Server — creates provider lazily per request
// because D1 binding and env are only available inside request context.
// ---------------------------------------------------------------------------
// mcpAuthRouter installs all standard endpoints at the application root:
//   /.well-known/oauth-authorization-server
//   /.well-known/oauth-protected-resource
//   /authorize, /token, /register, /revoke
//
// The provider is created once per application lifecycle via the Hono
// middleware chain. We use a middleware to inject the provider into the
// router options dynamically based on the current request's env bindings.

mcpRoute.all("/.well-known/*", async (c, _next) => {
	const provider = createMcpAuthProvider(c.env.DB, c.env);
	const workerUrl = c.env.WORKER_URL;
	const issuerUrl = workerUrl.endsWith("/") ? workerUrl.slice(0, -1) : workerUrl;

	const authRouter = mcpAuthRouter({
		provider,
		issuerUrl,
		scopesSupported: [...MCP_OAUTH_CONFIG.scopesSupported],
		serviceDocumentationUrl: new URL("/docs", issuerUrl),
		clientRegistrationOptions: {
			clientSecretExpirySeconds: MCP_OAUTH_CONFIG.clientSecretExpiryDays * 24 * 60 * 60,
		},
	});

	const app = new Hono<Env>();
	app.route("/", authRouter);
	return app.fetch(c.req.raw, c.env, c.executionCtx);
});

// /authorize — requires authenticated staff (not in PUBLIC_ROUTES)
// authMiddleware runs before this, setting c.get('staff') from session cookie or API key
mcpRoute.all("/authorize", async (c) => {
	const staff = c.get("staff") as { id: string } | undefined;
	if (!staff?.id) {
		return c.json({ error: "Authentication required. Log in before authorizing MCP clients." }, 401);
	}

	const provider = createMcpAuthProvider(c.env.DB, c.env, staff.id);
	const workerUrl = c.env.WORKER_URL;
	const issuerUrl = workerUrl.endsWith("/") ? workerUrl.slice(0, -1) : workerUrl;

	const authRouter = mcpAuthRouter({
		provider,
		issuerUrl,
		scopesSupported: [...MCP_OAUTH_CONFIG.scopesSupported],
		serviceDocumentationUrl: new URL("/docs", issuerUrl),
		clientRegistrationOptions: {
			clientSecretExpirySeconds: MCP_OAUTH_CONFIG.clientSecretExpiryDays * 24 * 60 * 60,
		},
	});

	const app = new Hono<Env>();
	app.route("/", authRouter);
	return app.fetch(c.req.raw, c.env, c.executionCtx);
});

// /register — requires authenticated staff (not in PUBLIC_ROUTES)
// Prevents unauthenticated dynamic client registration
mcpRoute.all("/register", async (c) => {
	const staff = c.get("staff") as { id: string } | undefined;
	if (!staff?.id) {
		return c.json({ error: "Authentication required for client registration." }, 401);
	}

	const provider = createMcpAuthProvider(c.env.DB, c.env);
	const workerUrl = c.env.WORKER_URL;
	const issuerUrl = workerUrl.endsWith("/") ? workerUrl.slice(0, -1) : workerUrl;

	const authRouter = mcpAuthRouter({
		provider,
		issuerUrl,
		scopesSupported: [...MCP_OAUTH_CONFIG.scopesSupported],
		serviceDocumentationUrl: new URL("/docs", issuerUrl),
		clientRegistrationOptions: {
			clientSecretExpirySeconds: MCP_OAUTH_CONFIG.clientSecretExpiryDays * 24 * 60 * 60,
		},
	});

	const app = new Hono<Env>();
	app.route("/", authRouter);
	return app.fetch(c.req.raw, c.env, c.executionCtx);
});

// Handle public OAuth endpoints: /token, /revoke (these need to be accessible for token exchange)
for (const path of ["/token", "/revoke"] as const) {
	mcpRoute.all(path, async (c) => {
		const provider = createMcpAuthProvider(c.env.DB, c.env);
		const workerUrl = c.env.WORKER_URL;
		const issuerUrl = workerUrl.endsWith("/") ? workerUrl.slice(0, -1) : workerUrl;

		const authRouter = mcpAuthRouter({
			provider,
			issuerUrl,
			scopesSupported: [...MCP_OAUTH_CONFIG.scopesSupported],
			serviceDocumentationUrl: new URL("/docs", issuerUrl),
			clientRegistrationOptions: {
				clientSecretExpirySeconds: MCP_OAUTH_CONFIG.clientSecretExpiryDays * 24 * 60 * 60,
			},
		});

		const app = new Hono<Env>();
		app.route("/", authRouter);
		return app.fetch(c.req.raw, c.env, c.executionCtx);
	});
}

// ---------------------------------------------------------------------------
// MCP Server Factory — creates a fresh server per request (stateless mode)
// ---------------------------------------------------------------------------

/**
 * Creates a configured McpServer instance with all tools and resources
 * registered. Each request gets its own server to avoid shared state
 * between concurrent requests in the Workers runtime.
 *
 * @param db - D1 database binding for tool implementations
 * @param env - Worker environment bindings for LINE API access
 */
function createMcpServerInstance(db: D1Database, env: Env["Bindings"]): McpServer {
	const server = new McpServer({
		name: MCP_CONFIG.serverName,
		version: MCP_CONFIG.serverVersion,
	});

	// Register all tools (friends, broadcasts, scenarios, tags, etc.)
	registerHttpMcpTools(server, db, env);

	// Register all resources (account summary, active scenarios, tags)
	registerHttpMcpResources(server, db);

	return server;
}

// ---------------------------------------------------------------------------
// Bearer Auth Middleware — MCP spec-compliant token verification
// ---------------------------------------------------------------------------
// Uses @hono/mcp's bearerAuth which follows the MCP OAuth 2.1 spec for
// Bearer token extraction and error responses. Falls through to the
// provider's verifyAccessToken which supports:
//   1. OAuth-issued access tokens (mcp_at_* prefix)
//   2. Staff API keys (lh_* prefix, backward compat)
//   3. Environment API_KEY (owner-level access)

mcpRoute.use("/mcp", async (c, next) => {
	const provider = createMcpAuthProvider(c.env.DB, c.env);
	const middleware = mcpBearerAuth({
		verifyToken: async (token: string) => {
			try {
				await provider.verifyAccessToken(token);
				return true;
			} catch {
				return false;
			}
		},
	});
	return middleware(c, next);
});

// ---------------------------------------------------------------------------
// Route handler — delegates to StreamableHTTPTransport
// ---------------------------------------------------------------------------
// Supports all three HTTP methods required by the Streamable HTTP transport:
//   POST  — JSON-RPC request/response
//   GET   — SSE stream for server-initiated notifications
//   DELETE — session teardown (no-op in stateless mode)

mcpRoute.all("/mcp", async (c) => {
	const server = createMcpServerInstance(c.env.DB, c.env);

	// Stateless mode: no sessionIdGenerator — each request is independent.
	// enableJsonResponse: true for simpler client integration (no SSE needed
	// for single request/response exchanges).
	const transport = new StreamableHTTPTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: MCP_CONFIG.enableJsonResponse,
	});

	await server.connect(transport);
	return transport.handleRequest(c);
});

export { mcpRoute };
