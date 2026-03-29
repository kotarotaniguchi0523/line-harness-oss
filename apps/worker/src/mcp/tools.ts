// =============================================================================
// MCP HTTP Tools — Register all MCP tools for the HTTP transport endpoint
// =============================================================================
// Unlike packages/mcp-server (which uses the SDK client over HTTP), these
// tool implementations access D1 directly via the injected database binding.
// This avoids the SDK round-trip and runs entirely within the Worker.
//
// Each tool follows the MCP tool protocol:
//   - Returns { content: [{ type: "text", text: JSON }] } on success
//   - Returns { content: [...], isError: true } on failure
//
// Tool parameter schemas use Zod (SSOT per project convention).

// Legacy D1 helper imports — same pattern used by existing route handlers.
// These modules are not re-exported from the @line-crm/db barrel but are
// resolved by the wrangler bundler via workspace linking.
import {
	createBroadcastRepository,
	createDb,
	enrollFriendInScenario,
	getBroadcasts,
	getFriendById,
	getFriendCount,
	getFriends,
	getFriendTags,
	getScenarios,
	getTags,
} from "@line-crm/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../index.js";
import { clampPageSize, MCP_TOOLS, pageToOffset } from "./config.js";

// ---------------------------------------------------------------------------
// Helper: wrap a tool result as MCP text content
// ---------------------------------------------------------------------------

function textResult(data: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	};
}

function errorResult(error: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify({ success: false, error: String(error) }, null, 2),
			},
		],
		isError: true,
	};
}

// ---------------------------------------------------------------------------
// Registration entry point
// ---------------------------------------------------------------------------

/**
 * Registers all MCP tools that are accessible via the HTTP transport.
 * Each tool receives the D1 database binding and env for direct data access.
 *
 * @param server - McpServer instance to register tools on
 * @param db - D1 database binding from the Worker environment
 * @param env - Full Worker env bindings (for LINE API tokens, etc.)
 */
export function registerHttpMcpTools(server: McpServer, db: D1Database, env: Env["Bindings"]): void {
	registerListFriends(server, db);
	registerGetFriendDetail(server, db);
	registerListScenarios(server, db);
	registerEnrollScenario(server, db);
	registerManageTags(server, db);
	registerListBroadcasts(server, db);
	registerAccountSummary(server, db);
	registerSendMessage(server, env);
	registerBroadcast(server, db, env);
}

// ---------------------------------------------------------------------------
// list_friends
// ---------------------------------------------------------------------------

function registerListFriends(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.listFriends,
		"List LINE friends with optional tag filter. Returns paginated results with display name, follow status, and metadata.",
		{
			page: z.number().int().positive().default(1).describe("Page number (1-based)"),
			limit: z.number().int().positive().default(20).describe("Items per page (max 100)"),
			tagId: z.string().uuid().optional().describe("Filter by tag ID"),
		},
		async ({ page, limit, tagId }) => {
			try {
				const pageSize = clampPageSize(limit);
				const offset = pageToOffset(page, pageSize);
				const [friends, total] = await Promise.all([
					getFriends(db, { limit: pageSize, offset, tagId }),
					getFriendCount(db),
				]);
				return textResult({
					success: true,
					total,
					page,
					pageSize,
					hasNextPage: offset + pageSize < total,
					friends,
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// get_friend_detail
// ---------------------------------------------------------------------------

function registerGetFriendDetail(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.getFriendDetail,
		"Get detailed information about a specific friend, including all assigned tags and metadata.",
		{
			friendId: z.string().uuid().describe("The friend ID to look up"),
		},
		async ({ friendId }) => {
			try {
				const [friend, friendTags] = await Promise.all([getFriendById(db, friendId), getFriendTags(db, friendId)]);
				if (!friend) {
					return errorResult(`Friend not found: ${friendId}`);
				}
				return textResult({ success: true, friend, tags: friendTags });
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// list_scenarios
// ---------------------------------------------------------------------------

function registerListScenarios(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.listScenarios,
		"List all step scenarios with their step counts and active status. Use to see available automation flows before enrolling friends.",
		{
			activeOnly: z.boolean().default(false).describe("If true, only return active scenarios"),
		},
		async ({ activeOnly }) => {
			try {
				const scenarios = await getScenarios(db);
				const filtered = activeOnly ? scenarios.filter((s) => s.is_active === 1) : scenarios;
				return textResult({
					success: true,
					total: filtered.length,
					scenarios: filtered.map((s) => ({
						id: s.id,
						name: s.name,
						description: s.description,
						triggerType: s.trigger_type,
						isActive: s.is_active === 1,
						stepCount: s.step_count,
						createdAt: s.created_at,
					})),
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// enroll_scenario
// ---------------------------------------------------------------------------

function registerEnrollScenario(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.enrollScenario,
		"Enroll a friend into a step scenario. The friend will start receiving messages according to the scenario's step schedule.",
		{
			friendId: z.string().uuid().describe("The friend ID to enroll"),
			scenarioId: z.string().uuid().describe("The scenario ID to enroll into"),
		},
		async ({ friendId, scenarioId }) => {
			try {
				const result = await enrollFriendInScenario(db, friendId, scenarioId);
				return textResult({ success: true, enrollment: result });
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// manage_tags
// ---------------------------------------------------------------------------

function registerManageTags(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.manageTags,
		"List all available tags. Tags are used for friend segmentation, broadcast targeting, and scenario triggers.",
		{},
		async () => {
			try {
				const tagList = await getTags(db);
				return textResult({
					success: true,
					total: tagList.length,
					tags: tagList.map((t) => ({
						id: t.id,
						name: t.name,
						color: t.color,
						createdAt: t.created_at,
					})),
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// list_broadcasts
// ---------------------------------------------------------------------------

function registerListBroadcasts(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.listBroadcasts,
		"List all broadcasts with their status (draft, scheduled, sending, sent). Shows delivery counts and target configuration.",
		{},
		async () => {
			try {
				const broadcastList = await getBroadcasts(db);
				return textResult({
					success: true,
					total: broadcastList.length,
					broadcasts: broadcastList.map((b) => ({
						id: b.id,
						title: b.title,
						messageType: b.message_type,
						targetType: b.target_type,
						status: b.status,
						scheduledAt: b.scheduled_at,
						sentAt: b.sent_at,
						totalCount: b.total_count,
						successCount: b.success_count,
						createdAt: b.created_at,
					})),
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// account_summary
// ---------------------------------------------------------------------------

function registerAccountSummary(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.accountSummary,
		"Get a high-level summary of the LINE account: total friends, active scenarios, recent broadcasts, and tags. Use this first to understand the current state.",
		{},
		async () => {
			try {
				const [friendCount, scenarios, broadcasts, tagList] = await Promise.all([
					getFriendCount(db),
					getScenarios(db),
					getBroadcasts(db),
					getTags(db),
				]);

				const activeScenarios = scenarios.filter((s) => s.is_active === 1);
				const recentBroadcasts = broadcasts.slice(0, 5);

				return textResult({
					success: true,
					summary: {
						friends: { total: friendCount },
						scenarios: {
							total: scenarios.length,
							active: activeScenarios.length,
							activeList: activeScenarios.map((s) => ({
								id: s.id,
								name: s.name,
								triggerType: s.trigger_type,
							})),
						},
						broadcasts: {
							total: broadcasts.length,
							recent: recentBroadcasts.map((b) => ({
								id: b.id,
								title: b.title,
								status: b.status,
								sentAt: b.sent_at,
							})),
						},
						tags: {
							total: tagList.length,
							list: tagList.map((t) => ({ id: t.id, name: t.name })),
						},
					},
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// send_message (uses LINE API via env token)
// ---------------------------------------------------------------------------

function registerSendMessage(server: McpServer, env: Env["Bindings"]): void {
	server.tool(
		MCP_TOOLS.sendMessage,
		"Send a text message to a specific friend via LINE Messaging API push message.",
		{
			lineUserId: z.string().describe("LINE user ID (U-prefixed) of the recipient"),
			message: z.string().min(1).describe("Text message content to send"),
		},
		async ({ lineUserId, message }) => {
			try {
				const response = await fetch("https://api.line.me/v2/bot/message/push", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
					},
					body: JSON.stringify({
						to: lineUserId,
						messages: [{ type: "text", text: message }],
					}),
				});

				if (!response.ok) {
					const errorBody = await response.text();
					return errorResult(`LINE API error (${response.status}): ${errorBody}`);
				}

				return textResult({
					success: true,
					message: `Message sent to ${lineUserId}`,
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// broadcast (draft creation — does not send immediately)
// ---------------------------------------------------------------------------

function registerBroadcast(server: McpServer, db: D1Database, _env: Env["Bindings"]): void {
	server.tool(
		MCP_TOOLS.broadcast,
		"Create a new broadcast message as a draft. The broadcast will NOT be sent immediately — it must be scheduled or sent manually from the dashboard.",
		{
			title: z.string().min(1).describe("Broadcast title for internal reference"),
			messageContent: z.string().min(1).describe("Text content of the broadcast message"),
			targetType: z
				.enum(["all", "tag"])
				.default("all")
				.describe("Target: 'all' friends or friends with a specific 'tag'"),
			targetTagId: z.string().uuid().optional().describe("Required when targetType is 'tag' — the tag ID to target"),
		},
		async ({ title, messageContent, targetType, targetTagId }) => {
			try {
				const drizzle = createDb(db);
				const broadcastRepo = createBroadcastRepository(drizzle);
				const id = await broadcastRepo.create({
					title,
					messageType: "text",
					messageContent,
					targetType,
					targetTagId: targetTagId ?? null,
				});

				return textResult({
					success: true,
					broadcastId: id,
					status: "draft",
					message: "Broadcast created as draft. Schedule or send from the dashboard.",
				});
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}
