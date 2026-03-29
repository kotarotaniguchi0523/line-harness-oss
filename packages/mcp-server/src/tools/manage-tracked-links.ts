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

export function registerManageTrackedLinks(server: McpServer): void {
	server.tool(
		"manage_tracked_links",
		"Manage tracked links: list all or delete. For creating new tracked links, use create_tracked_link instead.",
		{
			action: z.enum(["list", "delete"]).describe("Action to perform"),
			linkId: z.string().optional().describe("Tracked link ID (for delete)"),
		},
		async (params) => {
			try {
				const client = getClient();
				const { action } = params;

				switch (action) {
					case "list": {
						const links = await client.trackedLinks.list();
						return mcpSuccess({ success: true, total: links.length, links });
					}
					case "delete": {
						if (!params.linkId) throw new Error("linkId is required for delete action");
						await client.trackedLinks.delete(params.linkId);
						return mcpSuccess({ success: true, deleted: params.linkId });
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
