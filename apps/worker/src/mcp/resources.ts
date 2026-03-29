// =============================================================================
// MCP HTTP Resources — Read-only data exposed as MCP resources
// =============================================================================
// Resources provide a way for MCP clients to read structured data without
// invoking tools. They are analogous to REST GET endpoints but follow the
// MCP resource protocol with URI-based addressing.
//
// Unlike the stdio-based packages/mcp-server that calls the HTTP API via SDK,
// these resource implementations access D1 directly within the Worker.

// Legacy D1 helper imports — same pattern used by existing route handlers
import { getBroadcasts, getFriendCount, getScenarios, getTags } from "@line-crm/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_RESOURCES } from "./config.js";

// ---------------------------------------------------------------------------
// Registration entry point
// ---------------------------------------------------------------------------

/**
 * Registers all MCP resources for the HTTP transport endpoint.
 * Resources are read-only views of account data that MCP clients can fetch
 * to understand the current state before invoking tools.
 *
 * @param server - McpServer instance to register resources on
 * @param db - D1 database binding from the Worker environment
 */
export function registerHttpMcpResources(server: McpServer, db: D1Database): void {
	registerAccountSummaryResource(server, db);
	registerActiveScenariosResource(server, db);
	registerTagsListResource(server, db);
}

// ---------------------------------------------------------------------------
// line-harness://account/summary
// ---------------------------------------------------------------------------

function registerAccountSummaryResource(server: McpServer, db: D1Database): void {
	server.resource("Account Summary", MCP_RESOURCES.accountSummary, async (_uri) => {
		const [friendCount, scenarios, broadcasts, tagList] = await Promise.all([
			getFriendCount(db),
			getScenarios(db),
			getBroadcasts(db),
			getTags(db),
		]);

		const activeScenarios = scenarios.filter((s) => s.is_active === 1);

		const summary = {
			friends: friendCount,
			activeScenarios: activeScenarios.length,
			totalScenarios: scenarios.length,
			totalBroadcasts: broadcasts.length,
			tags: tagList.map((t) => ({ id: t.id, name: t.name })),
		};

		return {
			contents: [
				{
					uri: MCP_RESOURCES.accountSummary,
					mimeType: "application/json",
					text: JSON.stringify(summary, null, 2),
				},
			],
		};
	});
}

// ---------------------------------------------------------------------------
// line-harness://scenarios/active
// ---------------------------------------------------------------------------

function registerActiveScenariosResource(server: McpServer, db: D1Database): void {
	server.resource("Active Scenarios", MCP_RESOURCES.activeScenarios, async (_uri) => {
		const scenarios = await getScenarios(db);
		const active = scenarios
			.filter((s) => s.is_active === 1)
			.map((s) => ({
				id: s.id,
				name: s.name,
				description: s.description,
				triggerType: s.trigger_type,
				stepCount: s.step_count,
				createdAt: s.created_at,
			}));

		return {
			contents: [
				{
					uri: MCP_RESOURCES.activeScenarios,
					mimeType: "application/json",
					text: JSON.stringify(active, null, 2),
				},
			],
		};
	});
}

// ---------------------------------------------------------------------------
// line-harness://tags/list
// ---------------------------------------------------------------------------

function registerTagsListResource(server: McpServer, db: D1Database): void {
	server.resource("Tags List", MCP_RESOURCES.tagsList, async (_uri) => {
		const tagList = await getTags(db);
		const result = tagList.map((t) => ({
			id: t.id,
			name: t.name,
			color: t.color,
			createdAt: t.created_at,
		}));

		return {
			contents: [
				{
					uri: MCP_RESOURCES.tagsList,
					mimeType: "application/json",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	});
}
