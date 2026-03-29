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

export function registerManageRichMenus(server: McpServer): void {
	server.tool(
		"manage_rich_menus",
		"Manage LINE rich menus: list all, delete, or set as default. For creating new rich menus, use create_rich_menu instead.",
		{
			action: z.enum(["list", "delete", "set_default"]).describe("Action to perform"),
			richMenuId: z.string().optional().describe("Rich menu ID (for delete/set_default)"),
		},
		async (params) => {
			try {
				const client = getClient();
				const { action } = params;

				switch (action) {
					case "list": {
						const menus = await client.richMenus.list();
						return mcpSuccess({ success: true, total: menus.length, richMenus: menus });
					}
					case "delete": {
						if (!params.richMenuId) throw new Error("richMenuId is required for delete action");
						await client.richMenus.delete(params.richMenuId);
						return mcpSuccess({ success: true, deleted: params.richMenuId });
					}
					case "set_default": {
						if (!params.richMenuId) throw new Error("richMenuId is required for set_default action");
						await client.richMenus.setDefault(params.richMenuId);
						return mcpSuccess({ success: true, defaultRichMenuId: params.richMenuId });
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
