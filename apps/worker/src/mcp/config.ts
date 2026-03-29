// =============================================================================
// MCP Server Configuration
// =============================================================================
// Centralised configuration for the HTTP-based MCP server endpoint.
// All magic values live here so that route and tool modules stay declarative.
//
// The version is kept in sync with the root package.json (v0.5.0).
// When bumping the project version, update `serverVersion` here as well.

// ---------------------------------------------------------------------------
// Server metadata — used by McpServer constructor and tool descriptions
// ---------------------------------------------------------------------------

export const MCP_CONFIG = {
	/** Server name reported in MCP `initialize` response */
	serverName: "line-harness",

	/** Semantic version reported to MCP clients */
	serverVersion: "0.5.0",

	/**
	 * When true, POST responses use plain JSON instead of SSE.
	 * Simpler for most AI agent integrations that do single
	 * request/response exchanges (no streaming needed).
	 */
	enableJsonResponse: true,

	/** Maximum items per paginated tool response */
	defaultPageSize: 20,

	/** Hard cap on items a single tool call can return */
	maxPageSize: 100,
} as const;

// ---------------------------------------------------------------------------
// Tool name constants — prevents typos across registration and tests
// ---------------------------------------------------------------------------

export const MCP_TOOLS = {
	listFriends: "list_friends",
	getFriendDetail: "get_friend_detail",
	sendMessage: "send_message",
	broadcast: "broadcast",
	listScenarios: "list_scenarios",
	enrollScenario: "enroll_scenario",
	manageTags: "manage_tags",
	listBroadcasts: "list_broadcasts",
	accountSummary: "account_summary",
	manageScenarios: "manage_scenarios",
	manageBroadcasts: "manage_broadcasts",
	manageForms: "manage_forms",
	manageTrackedLinks: "manage_tracked_links",
	manageRichMenus: "manage_rich_menus",
	manageFriends: "manage_friends",
} as const;

// ---------------------------------------------------------------------------
// Resource URI constants
// ---------------------------------------------------------------------------

export const MCP_RESOURCES = {
	accountSummary: "line-harness://account/summary",
	activeScenarios: "line-harness://scenarios/active",
	tagsList: "line-harness://tags/list",
} as const;

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a user-supplied page size to the configured bounds.
 * Returns a value guaranteed to be between 1 and `MCP_CONFIG.maxPageSize`.
 */
export function clampPageSize(requested: number | undefined): number {
	if (requested === undefined || requested <= 0) {
		return MCP_CONFIG.defaultPageSize;
	}
	return Math.min(requested, MCP_CONFIG.maxPageSize);
}

/**
 * Calculate the SQL OFFSET from a 1-based page number and page size.
 */
export function pageToOffset(page: number | undefined, pageSize: number): number {
	const safePage = page !== undefined && page >= 1 ? page : 1;
	return (safePage - 1) * pageSize;
}
