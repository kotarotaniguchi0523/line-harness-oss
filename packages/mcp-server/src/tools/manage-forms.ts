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

export function registerManageForms(server: McpServer): void {
	server.tool(
		"manage_forms",
		"Manage forms: list all, get details, update settings, or delete. For creating new forms, use create_form instead.",
		{
			action: z.enum(["list", "get", "update", "delete"]).describe("Action to perform"),
			formId: z.string().optional().describe("Form ID (for get/update/delete)"),
			name: z.string().optional().describe("Form name (for update)"),
			description: z.string().optional().describe("Form description (for update)"),
			fields: z
				.string()
				.optional()
				.describe(
					"JSON array of form fields (for update). Format: [{ name, label, type, required?, options?, placeholder? }]",
				),
			onSubmitTagId: z.string().optional().describe("Tag ID to auto-apply on submission (for update)"),
			onSubmitScenarioId: z.string().optional().describe("Scenario ID to auto-enroll on submission (for update)"),
			saveToMetadata: z.boolean().optional().describe("Save responses to friend metadata (for update)"),
			isActive: z.boolean().optional().describe("Active status (for update)"),
		},
		async (params) => {
			try {
				const client = getClient();
				const { action } = params;

				switch (action) {
					case "list": {
						const forms = await client.forms.list();
						return mcpSuccess({ success: true, total: forms.length, forms });
					}
					case "get": {
						if (!params.formId) throw new Error("formId is required for get action");
						const form = await client.forms.get(params.formId);
						return mcpSuccess({ success: true, form });
					}
					case "update": {
						if (!params.formId) throw new Error("formId is required for update action");
						const updates: Record<string, unknown> = {};
						if (params.name !== undefined) updates.name = params.name;
						if (params.description !== undefined) updates.description = params.description;
						if (params.fields !== undefined) updates.fields = JSON.parse(params.fields);
						if (params.onSubmitTagId !== undefined) updates.onSubmitTagId = params.onSubmitTagId;
						if (params.onSubmitScenarioId !== undefined) updates.onSubmitScenarioId = params.onSubmitScenarioId;
						if (params.saveToMetadata !== undefined) updates.saveToMetadata = params.saveToMetadata;
						if (params.isActive !== undefined) updates.isActive = params.isActive;
						const form = await client.forms.update(params.formId, updates);
						return mcpSuccess({ success: true, form });
					}
					case "delete": {
						if (!params.formId) throw new Error("formId is required for delete action");
						await client.forms.delete(params.formId);
						return mcpSuccess({ success: true, deleted: params.formId });
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
