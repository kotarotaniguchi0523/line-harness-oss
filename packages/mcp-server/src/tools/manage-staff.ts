import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";

type McpTextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function mcpSuccess(data: unknown): McpTextResult {
	return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

type StaffClient = ReturnType<typeof getClient>["staff"];

async function handleStaffAction(
	staff: StaffClient,
	action: string,
	params: {
		name?: string;
		email?: string | null;
		role?: "admin" | "staff";
		staffId?: string;
		isActive?: boolean;
	},
): Promise<McpTextResult> {
	switch (action) {
		case "me":
			return mcpSuccess({ success: true, profile: await staff.me() });
		case "list":
			return mcpSuccess({ success: true, members: await staff.list() });
		case "create": {
			if (!params.name) throw new Error("name is required for create action");
			if (!params.role) throw new Error("role is required for create action");
			const member = await staff.create({ name: params.name, email: params.email, role: params.role });
			return mcpSuccess({ success: true, member, note: "APIキーは一度だけ表示されます。安全に保管してください。" });
		}
		case "get": {
			if (!params.staffId) throw new Error("staffId is required for get action");
			return mcpSuccess({ success: true, member: await staff.get(params.staffId) });
		}
		case "update": {
			if (!params.staffId) throw new Error("staffId is required for update action");
			const updates: Record<string, unknown> = {};
			if (params.name !== undefined) updates.name = params.name;
			if (params.email !== undefined) updates.email = params.email;
			if (params.role !== undefined) updates.role = params.role;
			if (params.isActive !== undefined) updates.isActive = params.isActive;
			return mcpSuccess({ success: true, member: await staff.update(params.staffId, updates) });
		}
		case "delete": {
			if (!params.staffId) throw new Error("staffId is required for delete action");
			await staff.delete(params.staffId);
			return mcpSuccess({ success: true, deleted: params.staffId });
		}
		case "regenerate_key": {
			if (!params.staffId) throw new Error("staffId is required for regenerate_key action");
			const result = await staff.regenerateKey(params.staffId);
			return mcpSuccess({
				success: true,
				staffId: params.staffId,
				newApiKey: result.apiKey,
				note: "新しいAPIキーは一度だけ表示されます。安全に保管してください。",
			});
		}
		default:
			throw new Error(`Unknown action: ${action}`);
	}
}

export function registerManageStaff(server: McpServer): void {
	server.tool(
		"manage_staff",
		"スタッフアカウントの追加・一覧・更新・削除・APIキー再生成。オーナー権限が必要です。",
		{
			action: z
				.enum(["create", "list", "get", "update", "delete", "regenerate_key", "me"])
				.describe("Action to perform"),
			name: z.string().optional().describe("Staff name (for 'create' action)"),
			email: z.string().nullable().optional().describe("Staff email (optional, null to clear)"),
			role: z.enum(["admin", "staff"]).optional().describe("Staff role (for 'create'/'update')"),
			staffId: z.string().optional().describe("Staff ID (for 'get','update','delete','regenerate_key')"),
			isActive: z.boolean().optional().describe("Activate/deactivate (for 'update')"),
		},
		async ({ action, name, email, role, staffId, isActive }) => {
			try {
				const client = getClient();
				return await handleStaffAction(client.staff, action, { name, email, role, staffId, isActive });
			} catch (error) {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: String(error) }, null, 2) }],
					isError: true,
				};
			}
		},
	);
}
