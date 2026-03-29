import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";

type McpTextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function mcpSuccess(data: unknown): McpTextResult {
	return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function mcpError(error: unknown): McpTextResult {
	return {
		content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: String(error) }, null, 2) }],
		isError: true,
	};
}

export function registerManageBroadcasts(server: McpServer): void {
	server.tool(
		"manage_broadcasts",
		"Manage broadcasts: list all, get details, create drafts, update, or send. For immediate broadcast with auto-tracking and segment support, use the broadcast tool instead.",
		{
			action: z.enum(["list", "get", "create_draft", "update", "send"]).describe("Action to perform"),
			broadcastId: z.string().optional().describe("Broadcast ID (for get/update/send)"),
			title: z.string().optional().describe("Broadcast title (for create_draft/update)"),
			messageType: z.enum(["text", "image", "flex"]).optional().describe("Message type (for create_draft/update)"),
			messageContent: z.string().optional().describe("Message content (for create_draft/update)"),
			targetType: z.enum(["all", "tag"]).optional().describe("Target audience (for create_draft/update)"),
			targetTagId: z.string().optional().describe("Tag ID when targetType is 'tag'"),
			scheduledAt: z.string().optional().describe("ISO 8601 datetime to schedule (for create_draft/update)"),
			accountId: z.string().optional().describe("LINE account ID (for list/create_draft, uses default if omitted)"),
		},
		async (params) => {
			try {
				const client = getClient();
				const { action } = params;

				switch (action) {
					case "list": {
						const broadcasts = await client.broadcasts.list({ accountId: params.accountId });
						return mcpSuccess({ success: true, total: broadcasts.length, broadcasts });
					}
					case "get": {
						if (!params.broadcastId) throw new Error("broadcastId is required for get action");
						const broadcast = await client.broadcasts.get(params.broadcastId);
						return mcpSuccess({ success: true, broadcast });
					}
					case "create_draft": {
						if (!params.title) throw new Error("title is required for create_draft action");
						if (!params.messageType) throw new Error("messageType is required for create_draft action");
						if (!params.messageContent) throw new Error("messageContent is required for create_draft action");
						const broadcast = await client.broadcasts.create({
							title: params.title,
							messageType: params.messageType,
							messageContent: params.messageContent,
							targetType: params.targetType ?? "all",
							targetTagId: params.targetTagId,
							scheduledAt: params.scheduledAt,
							lineAccountId: params.accountId,
						});
						return mcpSuccess({
							success: true,
							broadcast,
							note: params.scheduledAt
								? "Broadcast scheduled. It will be sent at the specified time."
								: "Broadcast created as draft. Use send action to dispatch.",
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
						const broadcast = await client.broadcasts.update(params.broadcastId, updates);
						return mcpSuccess({ success: true, broadcast });
					}
					case "send": {
						if (!params.broadcastId) throw new Error("broadcastId is required for send action");
						const broadcast = await client.broadcasts.send(params.broadcastId);
						return mcpSuccess({ success: true, broadcast, note: "Broadcast sent successfully." });
					}
					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				return mcpError(error);
			}
		},
	);
}
