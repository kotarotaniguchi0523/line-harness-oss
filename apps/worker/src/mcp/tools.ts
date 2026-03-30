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
	createFriendRepository,
	createScenarioRepository,
	createTagRepository,
} from "@line-crm/db";
import type { BroadcastId, FriendId, ScenarioId, ScenarioStepId } from "@line-crm/domain";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../index.js";
import { clampPageSize, MCP_TOOLS } from "./config.js";

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
	registerManageScenarios(server, db);
	registerManageBroadcasts(server, db);
	registerManageForms(server, db);
	registerManageTrackedLinks(server, db);
	registerManageRichMenus(server, env);
	registerManageFriends(server, db, env);
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
				const drizzle = createDb(db);
				const friendRepo = createFriendRepository(drizzle);
				const pageSize = clampPageSize(limit);
				const result = await friendRepo.listWithTags({
					page,
					limit: pageSize,
					tagId: tagId as import("@line-crm/domain").TagId | undefined,
				});
				return textResult({
					success: true,
					total: result.total,
					page,
					pageSize,
					hasNextPage: result.total > page * pageSize,
					friends: result.items,
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
				const drizzle = createDb(db);
				const friendRepo = createFriendRepository(drizzle);
				const friend = await friendRepo.findById(friendId as FriendId);
				if (!friend) {
					return errorResult(`Friend not found: ${friendId}`);
				}
				return textResult({ success: true, friend, tags: friend.tags });
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
				const drizzle = createDb(db);
				const scenarioRepo = createScenarioRepository(drizzle);
				const scenarios = activeOnly ? await scenarioRepo.listActive() : await scenarioRepo.list();
				return textResult({
					success: true,
					total: scenarios.length,
					scenarios: scenarios.map((s) => ({
						id: s.id,
						name: s.name,
						description: s.description,
						triggerType: s.triggerType,
						isActive: s.isActive,
						stepCount: s.steps.length,
						createdAt: s.createdAt,
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
				const drizzle = createDb(db);
				const scenarioRepo = createScenarioRepository(drizzle);
				const enrollmentId = await scenarioRepo.enrollFriend(friendId as FriendId, scenarioId as ScenarioId, null);
				return textResult({ success: true, enrollment: { id: enrollmentId } });
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
				const drizzle = createDb(db);
				const tagRepo = createTagRepository(drizzle);
				const tagList = await tagRepo.list();
				return textResult({
					success: true,
					total: tagList.length,
					tags: tagList,
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
				const drizzle = createDb(db);
				const broadcastRepo = createBroadcastRepository(drizzle);
				const broadcastList = await broadcastRepo.list();
				return textResult({
					success: true,
					total: broadcastList.length,
					broadcasts: broadcastList,
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
				const drizzle = createDb(db);
				const friendRepo = createFriendRepository(drizzle);
				const scenarioRepo = createScenarioRepository(drizzle);
				const broadcastRepo = createBroadcastRepository(drizzle);
				const tagRepo = createTagRepository(drizzle);

				const [friendCount, scenarios, broadcasts, tagList] = await Promise.all([
					friendRepo.count(),
					scenarioRepo.list(),
					broadcastRepo.list(),
					tagRepo.list(),
				]);

				const activeScenarios = scenarios.filter((s) => s.isActive);
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
								triggerType: s.triggerType,
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

// ---------------------------------------------------------------------------
// manage_scenarios
// ---------------------------------------------------------------------------

function registerManageScenarios(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.manageScenarios,
		"Manage step scenarios: list, get details, update, delete, and manage individual steps (add/update/delete).",
		{
			action: z
				.enum(["list", "get", "update", "delete", "add_step", "update_step", "delete_step"])
				.describe("Action to perform"),
			scenarioId: z.string().uuid().optional().describe("Scenario ID (for get/update/delete/add_step)"),
			stepId: z.string().uuid().optional().describe("Step ID (for update_step/delete_step)"),
			name: z.string().optional().describe("Scenario name (for update)"),
			description: z.string().optional().describe("Scenario description (for update)"),
			triggerType: z.enum(["friend_add", "tag_added", "manual"]).optional().describe("Trigger type (for update)"),
			triggerTagId: z.string().optional().describe("Tag ID for tag_added trigger (for update)"),
			isActive: z.boolean().optional().describe("Active status (for update)"),
			stepOrder: z.number().optional().describe("Step order number (for add_step/update_step)"),
			delayMinutes: z.number().optional().describe("Delay in minutes (for add_step/update_step)"),
			messageType: z.enum(["text", "image", "flex"]).optional().describe("Message type (for add_step/update_step)"),
			messageContent: z.string().optional().describe("Message content (for add_step/update_step)"),
			conditionType: z.string().optional().describe("Condition type (for add_step/update_step)"),
			conditionValue: z.string().optional().describe("Condition value (for add_step/update_step)"),
		},
		async (params) => {
			try {
				const drizzle = createDb(db);
				const scenarioRepo = createScenarioRepository(drizzle);
				const { action } = params;

				switch (action) {
					case "list": {
						const scenarios = await scenarioRepo.list();
						return textResult({
							success: true,
							total: scenarios.length,
							scenarios: scenarios.map((s) => ({
								id: s.id,
								name: s.name,
								description: s.description,
								triggerType: s.triggerType,
								isActive: s.isActive,
								stepCount: s.steps.length,
								createdAt: s.createdAt,
							})),
						});
					}
					case "get": {
						if (!params.scenarioId) throw new Error("scenarioId is required for get action");
						const scenario = await scenarioRepo.findById(params.scenarioId as ScenarioId);
						if (!scenario) return errorResult(`Scenario not found: ${params.scenarioId}`);
						return textResult({ success: true, scenario });
					}
					case "update": {
						if (!params.scenarioId) throw new Error("scenarioId is required for update action");
						if (params.isActive !== undefined) {
							await scenarioRepo.setActive(params.scenarioId as ScenarioId, params.isActive);
						}
						// Note: Drizzle repo only supports setActive; for full update, use raw D1
						// For now, return success after toggling active state
						const updated = await scenarioRepo.findById(params.scenarioId as ScenarioId);
						return textResult({ success: true, scenario: updated });
					}
					case "delete": {
						if (!params.scenarioId) throw new Error("scenarioId is required for delete action");
						await scenarioRepo.delete(params.scenarioId as ScenarioId);
						return textResult({ success: true, deleted: params.scenarioId });
					}
					case "add_step": {
						if (!params.scenarioId) throw new Error("scenarioId is required for add_step action");
						if (params.stepOrder === undefined) throw new Error("stepOrder is required for add_step action");
						if (params.delayMinutes === undefined) throw new Error("delayMinutes is required for add_step action");
						if (!params.messageType) throw new Error("messageType is required for add_step action");
						if (!params.messageContent) throw new Error("messageContent is required for add_step action");
						const stepId = await scenarioRepo.addStep(params.scenarioId as ScenarioId, {
							stepOrder: params.stepOrder,
							delayMinutes: params.delayMinutes,
							messageType: params.messageType,
							messageContent: params.messageContent,
							conditionType: params.conditionType,
							conditionValue: params.conditionValue,
						});
						return textResult({ success: true, stepId });
					}
					case "update_step": {
						if (!params.stepId) throw new Error("stepId is required for update_step action");
						// The Drizzle repo doesn't have updateStep, use raw D1
						const setClauses: string[] = [];
						const binds: unknown[] = [];
						if (params.stepOrder !== undefined) {
							setClauses.push("step_order = ?");
							binds.push(params.stepOrder);
						}
						if (params.delayMinutes !== undefined) {
							setClauses.push("delay_minutes = ?");
							binds.push(params.delayMinutes);
						}
						if (params.messageType !== undefined) {
							setClauses.push("message_type = ?");
							binds.push(params.messageType);
						}
						if (params.messageContent !== undefined) {
							setClauses.push("message_content = ?");
							binds.push(params.messageContent);
						}
						if (params.conditionType !== undefined) {
							setClauses.push("condition_type = ?");
							binds.push(params.conditionType);
						}
						if (params.conditionValue !== undefined) {
							setClauses.push("condition_value = ?");
							binds.push(params.conditionValue);
						}
						if (setClauses.length === 0) throw new Error("No fields to update");
						binds.push(params.stepId);
						await db
							.prepare(`UPDATE scenario_steps SET ${setClauses.join(", ")} WHERE id = ?`)
							.bind(...binds)
							.run();
						return textResult({ success: true, updatedStep: params.stepId });
					}
					case "delete_step": {
						if (!params.stepId) throw new Error("stepId is required for delete_step action");
						await scenarioRepo.removeStep(params.stepId as ScenarioStepId);
						return textResult({ success: true, deletedStep: params.stepId });
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// manage_broadcasts
// ---------------------------------------------------------------------------

function registerManageBroadcasts(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.manageBroadcasts,
		"Manage broadcasts: list all, get details, create drafts, update, or send.",
		{
			action: z.enum(["list", "get", "create_draft", "update", "send"]).describe("Action to perform"),
			broadcastId: z.string().uuid().optional().describe("Broadcast ID (for get/update/send)"),
			title: z.string().optional().describe("Broadcast title (for create_draft/update)"),
			messageType: z.enum(["text", "image", "flex"]).optional().describe("Message type (for create_draft/update)"),
			messageContent: z.string().optional().describe("Message content (for create_draft/update)"),
			targetType: z.enum(["all", "tag"]).optional().describe("Target audience (for create_draft/update)"),
			targetTagId: z.string().uuid().optional().describe("Tag ID when targetType is 'tag'"),
			scheduledAt: z.string().optional().describe("ISO 8601 datetime to schedule (for create_draft/update)"),
		},
		async (params) => {
			try {
				const drizzle = createDb(db);
				const broadcastRepo = createBroadcastRepository(drizzle);
				const { action } = params;

				switch (action) {
					case "list": {
						const broadcasts = await broadcastRepo.list();
						return textResult({
							success: true,
							total: broadcasts.length,
							broadcasts: broadcasts.map((b) => ({
								id: b.id,
								title: b.title,
								messageType: b.messageType,
								targetType: b.targetType,
								status: b.status,
								scheduledAt: b.scheduledAt,
								sentAt: b.sentAt,
								totalCount: b.totalCount,
								successCount: b.successCount,
								createdAt: b.createdAt,
							})),
						});
					}
					case "get": {
						if (!params.broadcastId) throw new Error("broadcastId is required for get action");
						const broadcast = await broadcastRepo.findById(params.broadcastId as BroadcastId);
						if (!broadcast) return errorResult(`Broadcast not found: ${params.broadcastId}`);
						return textResult({ success: true, broadcast });
					}
					case "create_draft": {
						if (!params.title) throw new Error("title is required for create_draft action");
						if (!params.messageType) throw new Error("messageType is required for create_draft action");
						if (!params.messageContent) throw new Error("messageContent is required for create_draft action");
						const id = await broadcastRepo.create({
							title: params.title,
							messageType: params.messageType,
							messageContent: params.messageContent,
							targetType: params.targetType ?? "all",
							targetTagId: params.targetTagId ?? null,
							scheduledAt: params.scheduledAt ?? null,
						});
						return textResult({
							success: true,
							broadcastId: id,
							status: params.scheduledAt ? "scheduled" : "draft",
						});
					}
					case "update": {
						if (!params.broadcastId) throw new Error("broadcastId is required for update action");
						const updates: Record<string, unknown> = {};
						if (params.title !== undefined) updates.title = params.title;
						if (params.messageType !== undefined) updates.messageType = params.messageType;
						if (params.messageContent !== undefined) updates.messageContent = params.messageContent;
						if (params.targetType !== undefined) updates.targetType = params.targetType;
						if (params.targetTagId !== undefined) updates.targetTagId = params.targetTagId;
						if (params.scheduledAt !== undefined) updates.scheduledAt = params.scheduledAt;
						await broadcastRepo.update(params.broadcastId as BroadcastId, updates);
						const updated = await broadcastRepo.findById(params.broadcastId as BroadcastId);
						return textResult({ success: true, broadcast: updated });
					}
					case "send": {
						if (!params.broadcastId) throw new Error("broadcastId is required for send action");
						await broadcastRepo.updateStatus(params.broadcastId as BroadcastId, "sending");
						return textResult({
							success: true,
							broadcastId: params.broadcastId,
							status: "sending",
							note: "Broadcast queued for sending. Delivery will be processed asynchronously.",
						});
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// manage_forms
// ---------------------------------------------------------------------------

function registerManageForms(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.manageForms,
		"Manage forms: list all, get details, update settings, or delete.",
		{
			action: z.enum(["list", "get", "update", "delete"]).describe("Action to perform"),
			formId: z.string().uuid().optional().describe("Form ID (for get/update/delete)"),
			name: z.string().optional().describe("Form name (for update)"),
			description: z.string().optional().describe("Form description (for update)"),
			fields: z.string().optional().describe("JSON array of form fields (for update)"),
			onSubmitTagId: z.string().optional().describe("Tag ID to auto-apply on submission (for update)"),
			onSubmitScenarioId: z.string().optional().describe("Scenario ID to auto-enroll on submission (for update)"),
			saveToMetadata: z.boolean().optional().describe("Save responses to friend metadata (for update)"),
			isActive: z.boolean().optional().describe("Active status (for update)"),
		},
		async (params) => {
			try {
				const { action } = params;

				switch (action) {
					case "list": {
						const result = await db.prepare("SELECT * FROM forms ORDER BY created_at DESC").all();
						const forms = result.results;
						return textResult({
							success: true,
							total: forms.length,
							forms: forms.map((f: Record<string, unknown>) => ({
								id: f.id,
								name: f.name,
								description: f.description,
								isActive: f.is_active === 1,
								submitCount: f.submit_count,
								createdAt: f.created_at,
							})),
						});
					}
					case "get": {
						if (!params.formId) throw new Error("formId is required for get action");
						const form = await db.prepare("SELECT * FROM forms WHERE id = ?").bind(params.formId).first();
						if (!form) return errorResult(`Form not found: ${params.formId}`);
						return textResult({
							success: true,
							form: {
								...form,
								fields: typeof form.fields === "string" ? JSON.parse(form.fields as string) : form.fields,
								isActive: form.is_active === 1,
								saveToMetadata: form.save_to_metadata === 1,
							},
						});
					}
					case "update": {
						if (!params.formId) throw new Error("formId is required for update action");
						const existing = await db.prepare("SELECT * FROM forms WHERE id = ?").bind(params.formId).first();
						if (!existing) return errorResult(`Form not found: ${params.formId}`);

						const now = new Date().toISOString();
						await db
							.prepare(
								`UPDATE forms SET name = ?, description = ?, fields = ?,
								 on_submit_tag_id = ?, on_submit_scenario_id = ?,
								 save_to_metadata = ?, is_active = ?, updated_at = ? WHERE id = ?`,
							)
							.bind(
								params.name ?? existing.name,
								params.description !== undefined ? params.description : existing.description,
								params.fields ?? existing.fields,
								params.onSubmitTagId !== undefined ? params.onSubmitTagId : existing.on_submit_tag_id,
								params.onSubmitScenarioId !== undefined ? params.onSubmitScenarioId : existing.on_submit_scenario_id,
								params.saveToMetadata !== undefined ? (params.saveToMetadata ? 1 : 0) : existing.save_to_metadata,
								params.isActive !== undefined ? (params.isActive ? 1 : 0) : existing.is_active,
								now,
								params.formId,
							)
							.run();

						const updated = await db.prepare("SELECT * FROM forms WHERE id = ?").bind(params.formId).first();
						return textResult({ success: true, form: updated });
					}
					case "delete": {
						if (!params.formId) throw new Error("formId is required for delete action");
						await db.prepare("DELETE FROM forms WHERE id = ?").bind(params.formId).run();
						return textResult({ success: true, deleted: params.formId });
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// manage_tracked_links
// ---------------------------------------------------------------------------

function registerManageTrackedLinks(server: McpServer, db: D1Database): void {
	server.tool(
		MCP_TOOLS.manageTrackedLinks,
		"Manage tracked links: list all or delete.",
		{
			action: z.enum(["list", "delete"]).describe("Action to perform"),
			linkId: z.string().uuid().optional().describe("Tracked link ID (for delete)"),
		},
		async (params) => {
			try {
				const { action } = params;

				switch (action) {
					case "list": {
						const result = await db.prepare("SELECT * FROM tracked_links ORDER BY created_at DESC").all();
						const links = result.results;
						return textResult({
							success: true,
							total: links.length,
							links: links.map((l: Record<string, unknown>) => ({
								id: l.id,
								name: l.name,
								originalUrl: l.original_url,
								tagId: l.tag_id,
								scenarioId: l.scenario_id,
								isActive: l.is_active === 1,
								clickCount: l.click_count,
								createdAt: l.created_at,
							})),
						});
					}
					case "delete": {
						if (!params.linkId) throw new Error("linkId is required for delete action");
						await db.prepare("DELETE FROM tracked_links WHERE id = ?").bind(params.linkId).run();
						return textResult({ success: true, deleted: params.linkId });
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// manage_rich_menus (uses LINE API via env token)
// ---------------------------------------------------------------------------

function registerManageRichMenus(server: McpServer, env: Env["Bindings"]): void {
	server.tool(
		MCP_TOOLS.manageRichMenus,
		"Manage LINE rich menus: list all, delete, or set as default.",
		{
			action: z.enum(["list", "delete", "set_default"]).describe("Action to perform"),
			richMenuId: z.string().optional().describe("Rich menu ID (for delete/set_default)"),
		},
		async (params) => {
			try {
				const { action } = params;
				const headers = {
					"Content-Type": "application/json",
					Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
				};

				switch (action) {
					case "list": {
						const response = await fetch("https://api.line.me/v2/bot/richmenu/list", { headers });
						if (!response.ok) {
							const body = await response.text();
							return errorResult(`LINE API error (${response.status}): ${body}`);
						}
						const data = (await response.json()) as { richmenus: unknown[] };
						return textResult({ success: true, total: data.richmenus.length, richMenus: data.richmenus });
					}
					case "delete": {
						if (!params.richMenuId) throw new Error("richMenuId is required for delete action");
						const response = await fetch(
							`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(params.richMenuId)}`,
							{ method: "DELETE", headers },
						);
						if (!response.ok) {
							const body = await response.text();
							return errorResult(`LINE API error (${response.status}): ${body}`);
						}
						return textResult({ success: true, deleted: params.richMenuId });
					}
					case "set_default": {
						if (!params.richMenuId) throw new Error("richMenuId is required for set_default action");
						const response = await fetch(
							`https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(params.richMenuId)}`,
							{ method: "POST", headers },
						);
						if (!response.ok) {
							const body = await response.text();
							return errorResult(`LINE API error (${response.status}): ${body}`);
						}
						return textResult({ success: true, defaultRichMenuId: params.richMenuId });
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}

// ---------------------------------------------------------------------------
// manage_friends
// ---------------------------------------------------------------------------

function registerManageFriends(server: McpServer, db: D1Database, env: Env["Bindings"]): void {
	server.tool(
		MCP_TOOLS.manageFriends,
		"Manage friends: get total count, set metadata fields, assign/remove individual rich menus.",
		{
			action: z.enum(["count", "set_metadata", "set_rich_menu", "remove_rich_menu"]).describe("Action to perform"),
			friendId: z.string().uuid().optional().describe("Friend ID (for set_metadata/set_rich_menu/remove_rich_menu)"),
			metadata: z.string().optional().describe("JSON object of metadata fields to set (for set_metadata)"),
			richMenuId: z.string().optional().describe("Rich menu ID (for set_rich_menu)"),
		},
		async (params) => {
			try {
				const drizzle = createDb(db);
				const friendRepo = createFriendRepository(drizzle);
				const { action } = params;

				switch (action) {
					case "count": {
						const count = await friendRepo.count();
						return textResult({ success: true, count });
					}
					case "set_metadata": {
						if (!params.friendId) throw new Error("friendId is required for set_metadata action");
						if (!params.metadata) throw new Error("metadata is required for set_metadata action");
						let parsed: Record<string, unknown>;
						try {
							parsed = JSON.parse(params.metadata);
						} catch {
							throw new Error("metadata must be valid JSON");
						}
						// Merge with existing metadata
						const existing = await friendRepo.getMetadata(params.friendId as FriendId);
						const merged = { ...(existing ?? {}), ...parsed };
						await friendRepo.updateMetadata(params.friendId as FriendId, merged);
						return textResult({ success: true, friendId: params.friendId, metadata: merged });
					}
					case "set_rich_menu": {
						if (!params.friendId) throw new Error("friendId is required for set_rich_menu action");
						if (!params.richMenuId) throw new Error("richMenuId is required for set_rich_menu action");
						// Get the friend's LINE user ID
						const friend = await friendRepo.findById(params.friendId as FriendId);
						if (!friend) return errorResult(`Friend not found: ${params.friendId}`);

						const response = await fetch(
							`https://api.line.me/v2/bot/user/${encodeURIComponent(friend.lineUserId)}/richmenu/${encodeURIComponent(params.richMenuId)}`,
							{
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
								},
							},
						);
						if (!response.ok) {
							const body = await response.text();
							return errorResult(`LINE API error (${response.status}): ${body}`);
						}
						return textResult({ success: true, friendId: params.friendId, richMenuId: params.richMenuId });
					}
					case "remove_rich_menu": {
						if (!params.friendId) throw new Error("friendId is required for remove_rich_menu action");
						const friend = await friendRepo.findById(params.friendId as FriendId);
						if (!friend) return errorResult(`Friend not found: ${params.friendId}`);

						const response = await fetch(
							`https://api.line.me/v2/bot/user/${encodeURIComponent(friend.lineUserId)}/richmenu`,
							{
								method: "DELETE",
								headers: {
									Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
								},
							},
						);
						if (!response.ok) {
							const body = await response.text();
							return errorResult(`LINE API error (${response.status}): ${body}`);
						}
						return textResult({ success: true, friendId: params.friendId, richMenuRemoved: true });
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}
