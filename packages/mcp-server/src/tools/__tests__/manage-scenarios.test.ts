// Tests for a manage_scenarios MCP tool that follows the CRUD pattern
// established by manage-ad-platforms.ts and manage-staff.ts.
// NOTE: The manage-scenarios tool implementation is pending.
// These tests validate the expected interface.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the SDK client ─────────────────────────────────────────────────────
const mockScenarios = {
	list: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	addStep: vi.fn(),
};

vi.mock("../../client.js", () => ({
	getClient: () => ({
		scenarios: mockScenarios,
	}),
}));

// ── Inline handler to test until real implementation exists ──────────────────
type McpTextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function handleManageScenarios(params: {
	action: "list" | "get" | "create" | "update" | "delete";
	scenarioId?: string;
	name?: string;
	description?: string;
	triggerType?: "friend_add" | "tag_added" | "manual";
	triggerTagId?: string;
	isActive?: boolean;
	accountId?: string;
}): Promise<McpTextResult> {
	try {
		const { getClient } = await import("../../client.js");
		const client = getClient();

		switch (params.action) {
			case "list": {
				const scenarios = await client.scenarios.list({ accountId: params.accountId });
				return {
					content: [
						{ type: "text", text: JSON.stringify({ success: true, count: scenarios.length, scenarios }, null, 2) },
					],
				};
			}
			case "get": {
				if (!params.scenarioId) throw new Error("scenarioId is required for get action");
				const scenario = await client.scenarios.get(params.scenarioId);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, scenario }, null, 2) }],
				};
			}
			case "create": {
				if (!params.name) throw new Error("name is required for create action");
				if (!params.triggerType) throw new Error("triggerType is required for create action");
				const scenario = await client.scenarios.create({
					name: params.name,
					description: params.description,
					triggerType: params.triggerType,
					triggerTagId: params.triggerTagId,
					isActive: params.isActive,
					lineAccountId: params.accountId,
				});
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, scenario }, null, 2) }],
				};
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
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, scenario }, null, 2) }],
				};
			}
			case "delete": {
				if (!params.scenarioId) throw new Error("scenarioId is required for delete action");
				await client.scenarios.delete(params.scenarioId);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, deleted: params.scenarioId }) }],
				};
			}
			default:
				throw new Error(`Unknown action: ${params.action}`);
		}
	} catch (error) {
		return {
			content: [{ type: "text", text: JSON.stringify({ success: false, error: String(error) }, null, 2) }],
			isError: true,
		};
	}
}
// ── End inline handler ──────────────────────────────────────────────────────

function parseResult(result: McpTextResult): unknown {
	return JSON.parse(result.content[0].text);
}

describe("manage_scenarios MCP tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list action", () => {
		it("returns all scenarios", async () => {
			const scenarios = [
				{ id: "sc-1", name: "Welcome", triggerType: "friend_add", stepCount: 3 },
				{ id: "sc-2", name: "Tag follow-up", triggerType: "tag_added", stepCount: 2 },
			];
			mockScenarios.list.mockResolvedValue(scenarios);

			const result = await handleManageScenarios({ action: "list" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.count).toBe(2);
			expect(parsed.scenarios).toEqual(scenarios);
			expect(mockScenarios.list).toHaveBeenCalledWith({ accountId: undefined });
		});

		it("passes accountId when provided", async () => {
			mockScenarios.list.mockResolvedValue([]);

			await handleManageScenarios({ action: "list", accountId: "acc-1" });

			expect(mockScenarios.list).toHaveBeenCalledWith({ accountId: "acc-1" });
		});
	});

	describe("get action", () => {
		it("returns scenario with steps", async () => {
			const scenario = {
				id: "sc-1",
				name: "Welcome",
				steps: [{ id: "step-1", stepOrder: 1, delayMinutes: 0, messageType: "text", messageContent: "Hi!" }],
			};
			mockScenarios.get.mockResolvedValue(scenario);

			const result = await handleManageScenarios({ action: "get", scenarioId: "sc-1" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.scenario).toEqual(scenario);
			expect(mockScenarios.get).toHaveBeenCalledWith("sc-1");
		});

		it("returns error when scenarioId is missing", async () => {
			const result = await handleManageScenarios({ action: "get" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/scenarioId.*required/i);
			expect(result.isError).toBe(true);
		});
	});

	describe("create action", () => {
		it("creates a scenario with required fields", async () => {
			const scenario = { id: "sc-new", name: "Onboarding", triggerType: "friend_add" };
			mockScenarios.create.mockResolvedValue(scenario);

			const result = await handleManageScenarios({
				action: "create",
				name: "Onboarding",
				triggerType: "friend_add",
			});
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.scenario).toEqual(scenario);
			expect(mockScenarios.create).toHaveBeenCalledWith({
				name: "Onboarding",
				description: undefined,
				triggerType: "friend_add",
				triggerTagId: undefined,
				isActive: undefined,
				lineAccountId: undefined,
			});
		});

		it("returns error when name is missing", async () => {
			const result = await handleManageScenarios({ action: "create", triggerType: "manual" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/name.*required/i);
			expect(result.isError).toBe(true);
		});

		it("returns error when triggerType is missing", async () => {
			const result = await handleManageScenarios({ action: "create", name: "Test" } as any);
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/triggerType.*required/i);
		});
	});

	describe("update action", () => {
		it("updates scenario fields", async () => {
			const updated = { id: "sc-1", name: "Updated Welcome", isActive: false };
			mockScenarios.update.mockResolvedValue(updated);

			const result = await handleManageScenarios({
				action: "update",
				scenarioId: "sc-1",
				name: "Updated Welcome",
				isActive: false,
			});
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.scenario).toEqual(updated);
			expect(mockScenarios.update).toHaveBeenCalledWith("sc-1", {
				name: "Updated Welcome",
				isActive: false,
			});
		});

		it("returns error when scenarioId is missing", async () => {
			const result = await handleManageScenarios({ action: "update", name: "Test" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/scenarioId.*required/i);
		});
	});

	describe("delete action", () => {
		it("deletes a scenario by ID", async () => {
			mockScenarios.delete.mockResolvedValue(undefined);

			const result = await handleManageScenarios({ action: "delete", scenarioId: "sc-1" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.deleted).toBe("sc-1");
			expect(mockScenarios.delete).toHaveBeenCalledWith("sc-1");
		});

		it("returns error when scenarioId is missing", async () => {
			const result = await handleManageScenarios({ action: "delete" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/scenarioId.*required/i);
		});
	});

	describe("error handling", () => {
		it("wraps SDK errors in isError response", async () => {
			mockScenarios.list.mockRejectedValue(new Error("Network timeout"));

			const result = await handleManageScenarios({ action: "list" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain("Network timeout");
			expect(result.isError).toBe(true);
		});
	});
});
