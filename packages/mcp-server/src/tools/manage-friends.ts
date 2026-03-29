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

export function registerManageFriends(server: McpServer): void {
	server.tool(
		"manage_friends",
		"Manage friends: get total count, set metadata fields, assign/remove individual rich menus. For listing/searching friends use list_friends, for details use get_friend_detail.",
		{
			action: z.enum(["count", "set_metadata", "set_rich_menu", "remove_rich_menu"]).describe("Action to perform"),
			friendId: z.string().optional().describe("Friend ID (for set_metadata/set_rich_menu/remove_rich_menu)"),
			metadata: z
				.string()
				.optional()
				.describe("JSON object of metadata fields to set (for set_metadata). Merges with existing metadata."),
			richMenuId: z.string().optional().describe("Rich menu ID (for set_rich_menu)"),
		},
		async (params) => {
			try {
				const client = getClient();
				const { action } = params;

				switch (action) {
					case "count": {
						const count = await client.friends.count();
						return mcpSuccess({ success: true, count });
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
						const friend = await client.friends.setMetadata(params.friendId, parsed);
						return mcpSuccess({ success: true, friend });
					}
					case "set_rich_menu": {
						if (!params.friendId) throw new Error("friendId is required for set_rich_menu action");
						if (!params.richMenuId) throw new Error("richMenuId is required for set_rich_menu action");
						await client.friends.setRichMenu(params.friendId, params.richMenuId);
						return mcpSuccess({ success: true, friendId: params.friendId, richMenuId: params.richMenuId });
					}
					case "remove_rich_menu": {
						if (!params.friendId) throw new Error("friendId is required for remove_rich_menu action");
						await client.friends.removeRichMenu(params.friendId);
						return mcpSuccess({ success: true, friendId: params.friendId, richMenuRemoved: true });
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
