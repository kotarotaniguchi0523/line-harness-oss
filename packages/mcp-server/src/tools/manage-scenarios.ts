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

export function registerManageScenarios(server: McpServer): void {
	server.tool(
		"manage_scenarios",
		"Manage step scenarios: list, get details, update, delete, and manage individual steps (add/update/delete). For creating new scenarios, use create_scenario instead.",
		{
			action: z
				.enum(["list", "get", "update", "delete", "add_step", "update_step", "delete_step"])
				.describe("Action to perform"),
			scenarioId: z.string().optional().describe("Scenario ID (for get/update/delete/add_step)"),
			stepId: z.string().optional().describe("Step ID (for update_step/delete_step)"),
			name: z.string().optional().describe("Scenario name (for update)"),
			description: z.string().optional().describe("Scenario description (for update)"),
			triggerType: z.enum(["friend_add", "tag_added", "manual"]).optional().describe("Trigger type (for update)"),
			triggerTagId: z.string().optional().describe("Tag ID for tag_added trigger (for update)"),
			isActive: z.boolean().optional().describe("Active status (for update)"),
			stepOrder: z.number().optional().describe("Step order number (for add_step/update_step)"),
			delayMinutes: z.number().optional().describe("Delay in minutes before sending (for add_step/update_step)"),
			messageType: z.enum(["text", "image", "flex"]).optional().describe("Message type (for add_step/update_step)"),
			messageContent: z.string().optional().describe("Message content (for add_step/update_step)"),
			conditionType: z.string().optional().describe("Condition type (for add_step/update_step)"),
			conditionValue: z.string().optional().describe("Condition value (for add_step/update_step)"),
			accountId: z.string().optional().describe("LINE account ID (for list, uses default if omitted)"),
		},
		async (params) => {
			try {
				const client = getClient();
				const { action } = params;

				switch (action) {
					case "list": {
						const scenarios = await client.scenarios.list({ accountId: params.accountId });
						return mcpSuccess({ success: true, total: scenarios.length, scenarios });
					}
					case "get": {
						if (!params.scenarioId) throw new Error("scenarioId is required for get action");
						const scenario = await client.scenarios.get(params.scenarioId);
						return mcpSuccess({ success: true, scenario });
					}
					case "update": {
						if (!params.scenarioId) throw new Error("scenarioId is required for update action");
						const updates: Record<string, unknown> = {};
						if (params.name !== undefined) updates.name = params.name;
						if (params.description !== undefined) updates.description = params.description;
						if (params.triggerType !== undefined) updates.triggerType = params.triggerType;
						if (params.triggerTagId !== undefined) updates.triggerTagId = params.triggerTagId;
						if (params.isActive !== undefined) updates.isActive = params.isActive;
						const scenario = await client.scenarios.update(params.scenarioId, updates);
						return mcpSuccess({ success: true, scenario });
					}
					case "delete": {
						if (!params.scenarioId) throw new Error("scenarioId is required for delete action");
						await client.scenarios.delete(params.scenarioId);
						return mcpSuccess({ success: true, deleted: params.scenarioId });
					}
					case "add_step": {
						if (!params.scenarioId) throw new Error("scenarioId is required for add_step action");
						if (params.stepOrder === undefined) throw new Error("stepOrder is required for add_step action");
						if (params.delayMinutes === undefined) throw new Error("delayMinutes is required for add_step action");
						if (!params.messageType) throw new Error("messageType is required for add_step action");
						if (!params.messageContent) throw new Error("messageContent is required for add_step action");
						const step = await client.scenarios.addStep(params.scenarioId, {
							stepOrder: params.stepOrder,
							delayMinutes: params.delayMinutes,
							messageType: params.messageType,
							messageContent: params.messageContent,
							conditionType: params.conditionType ?? null,
							conditionValue: params.conditionValue ?? null,
						});
						return mcpSuccess({ success: true, step });
					}
					case "update_step": {
						if (!params.scenarioId) throw new Error("scenarioId is required for update_step action");
						if (!params.stepId) throw new Error("stepId is required for update_step action");
						const stepUpdates: Record<string, unknown> = {};
						if (params.stepOrder !== undefined) stepUpdates.stepOrder = params.stepOrder;
						if (params.delayMinutes !== undefined) stepUpdates.delayMinutes = params.delayMinutes;
						if (params.messageType !== undefined) stepUpdates.messageType = params.messageType;
						if (params.messageContent !== undefined) stepUpdates.messageContent = params.messageContent;
						if (params.conditionType !== undefined) stepUpdates.conditionType = params.conditionType;
						if (params.conditionValue !== undefined) stepUpdates.conditionValue = params.conditionValue;
						const step = await client.scenarios.updateStep(params.scenarioId, params.stepId, stepUpdates);
						return mcpSuccess({ success: true, step });
					}
					case "delete_step": {
						if (!params.scenarioId) throw new Error("scenarioId is required for delete_step action");
						if (!params.stepId) throw new Error("stepId is required for delete_step action");
						await client.scenarios.deleteStep(params.scenarioId, params.stepId);
						return mcpSuccess({ success: true, deletedStep: params.stepId });
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
