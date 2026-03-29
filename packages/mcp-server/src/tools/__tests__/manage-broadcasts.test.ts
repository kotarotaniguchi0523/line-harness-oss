// Tests for a manage_broadcasts MCP tool that follows the CRUD pattern
// established by manage-ad-platforms.ts and manage-staff.ts.
// NOTE: The manage-broadcasts tool implementation is pending.
// These tests validate the expected interface.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the SDK client ─────────────────────────────────────────────────────
const mockBroadcasts = {
	list: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	send: vi.fn(),
	sendToSegment: vi.fn(),
};

vi.mock("../../client.js", () => ({
	getClient: () => ({
		broadcasts: mockBroadcasts,
	}),
}));

// ── Inline handler to test until real implementation exists ──────────────────
type McpTextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function handleManageBroadcasts(params: {
	action: "list" | "get" | "create" | "update" | "delete" | "send";
	broadcastId?: string;
	title?: string;
	messageType?: "text" | "flex";
	messageContent?: string;
	targetType?: "all" | "tag";
	targetTagId?: string;
	scheduledAt?: string;
	accountId?: string;
}): Promise<McpTextResult> {
	try {
		const { getClient } = await import("../../client.js");
		const client = getClient();

		switch (params.action) {
			case "list": {
				const broadcasts = await client.broadcasts.list({ accountId: params.accountId });
				return {
					content: [
						{ type: "text", text: JSON.stringify({ success: true, count: broadcasts.length, broadcasts }, null, 2) },
					],
				};
			}
			case "get": {
				if (!params.broadcastId) throw new Error("broadcastId is required for get action");
				const broadcast = await client.broadcasts.get(params.broadcastId);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, broadcast }, null, 2) }],
				};
			}
			case "create": {
				if (!params.title) throw new Error("title is required for create action");
				if (!params.messageType) throw new Error("messageType is required for create action");
				if (!params.messageContent) throw new Error("messageContent is required for create action");
				const broadcast = await client.broadcasts.create({
					title: params.title,
					messageType: params.messageType,
					messageContent: params.messageContent,
					targetType: params.targetType ?? "all",
					targetTagId: params.targetTagId,
					scheduledAt: params.scheduledAt,
					lineAccountId: params.accountId,
				});
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, broadcast }, null, 2) }],
				};
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
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, broadcast }, null, 2) }],
				};
			}
			case "delete": {
				if (!params.broadcastId) throw new Error("broadcastId is required for delete action");
				await client.broadcasts.delete(params.broadcastId);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, deleted: params.broadcastId }) }],
				};
			}
			case "send": {
				if (!params.broadcastId) throw new Error("broadcastId is required for send action");
				const broadcast = await client.broadcasts.send(params.broadcastId);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true, broadcast }, null, 2) }],
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

describe("manage_broadcasts MCP tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list action", () => {
		it("returns all broadcasts", async () => {
			const broadcasts = [
				{ id: "bc-1", title: "Spring Sale", status: "sent" },
				{ id: "bc-2", title: "Summer Sale", status: "draft" },
			];
			mockBroadcasts.list.mockResolvedValue(broadcasts);

			const result = await handleManageBroadcasts({ action: "list" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.count).toBe(2);
			expect(parsed.broadcasts).toEqual(broadcasts);
		});

		it("passes accountId to list", async () => {
			mockBroadcasts.list.mockResolvedValue([]);

			await handleManageBroadcasts({ action: "list", accountId: "acc-1" });

			expect(mockBroadcasts.list).toHaveBeenCalledWith({ accountId: "acc-1" });
		});

		it("returns empty array when no broadcasts exist", async () => {
			mockBroadcasts.list.mockResolvedValue([]);

			const result = await handleManageBroadcasts({ action: "list" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.count).toBe(0);
			expect(parsed.broadcasts).toEqual([]);
		});
	});

	describe("get action", () => {
		it("returns a single broadcast", async () => {
			const broadcast = {
				id: "bc-1",
				title: "Spring Sale",
				messageType: "text",
				messageContent: "50% off!",
				status: "sent",
			};
			mockBroadcasts.get.mockResolvedValue(broadcast);

			const result = await handleManageBroadcasts({ action: "get", broadcastId: "bc-1" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.broadcast).toEqual(broadcast);
			expect(mockBroadcasts.get).toHaveBeenCalledWith("bc-1");
		});

		it("returns error when broadcastId is missing", async () => {
			const result = await handleManageBroadcasts({ action: "get" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/broadcastId.*required/i);
			expect(result.isError).toBe(true);
		});
	});

	describe("create action", () => {
		it("creates a broadcast with required fields", async () => {
			const broadcast = {
				id: "bc-new",
				title: "Flash Sale",
				messageType: "text",
				messageContent: "Buy now!",
				targetType: "all",
				status: "draft",
			};
			mockBroadcasts.create.mockResolvedValue(broadcast);

			const result = await handleManageBroadcasts({
				action: "create",
				title: "Flash Sale",
				messageType: "text",
				messageContent: "Buy now!",
			});
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.broadcast).toEqual(broadcast);
			expect(mockBroadcasts.create).toHaveBeenCalledWith({
				title: "Flash Sale",
				messageType: "text",
				messageContent: "Buy now!",
				targetType: "all",
				targetTagId: undefined,
				scheduledAt: undefined,
				lineAccountId: undefined,
			});
		});

		it("creates a broadcast targeting a tag", async () => {
			mockBroadcasts.create.mockResolvedValue({ id: "bc-tag" });

			await handleManageBroadcasts({
				action: "create",
				title: "VIP Sale",
				messageType: "text",
				messageContent: "Exclusive deal",
				targetType: "tag",
				targetTagId: "tag-vip",
			});

			expect(mockBroadcasts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					targetType: "tag",
					targetTagId: "tag-vip",
				}),
			);
		});

		it("creates a scheduled broadcast", async () => {
			mockBroadcasts.create.mockResolvedValue({ id: "bc-sched" });

			await handleManageBroadcasts({
				action: "create",
				title: "Planned",
				messageType: "text",
				messageContent: "Coming soon",
				scheduledAt: "2026-04-01T10:00:00Z",
			});

			expect(mockBroadcasts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					scheduledAt: "2026-04-01T10:00:00Z",
				}),
			);
		});

		it("returns error when title is missing", async () => {
			const result = await handleManageBroadcasts({
				action: "create",
				messageType: "text",
				messageContent: "Hi",
			} as any);
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/title.*required/i);
		});

		it("returns error when messageType is missing", async () => {
			const result = await handleManageBroadcasts({
				action: "create",
				title: "Test",
				messageContent: "Hi",
			} as any);
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/messageType.*required/i);
		});

		it("returns error when messageContent is missing", async () => {
			const result = await handleManageBroadcasts({
				action: "create",
				title: "Test",
				messageType: "text",
			} as any);
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/messageContent.*required/i);
		});
	});

	describe("update action", () => {
		it("updates broadcast fields", async () => {
			const updated = { id: "bc-1", title: "Updated Sale", messageContent: "70% off!" };
			mockBroadcasts.update.mockResolvedValue(updated);

			const result = await handleManageBroadcasts({
				action: "update",
				broadcastId: "bc-1",
				title: "Updated Sale",
				messageContent: "70% off!",
			});
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.broadcast).toEqual(updated);
			expect(mockBroadcasts.update).toHaveBeenCalledWith("bc-1", {
				title: "Updated Sale",
				messageContent: "70% off!",
			});
		});

		it("returns error when broadcastId is missing", async () => {
			const result = await handleManageBroadcasts({ action: "update", title: "Test" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/broadcastId.*required/i);
		});
	});

	describe("delete action", () => {
		it("deletes a broadcast by ID", async () => {
			mockBroadcasts.delete.mockResolvedValue(undefined);

			const result = await handleManageBroadcasts({ action: "delete", broadcastId: "bc-1" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.deleted).toBe("bc-1");
			expect(mockBroadcasts.delete).toHaveBeenCalledWith("bc-1");
		});

		it("returns error when broadcastId is missing", async () => {
			const result = await handleManageBroadcasts({ action: "delete" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/broadcastId.*required/i);
		});
	});

	describe("send action", () => {
		it("sends a broadcast immediately", async () => {
			const broadcast = { id: "bc-1", status: "sending" };
			mockBroadcasts.send.mockResolvedValue(broadcast);

			const result = await handleManageBroadcasts({ action: "send", broadcastId: "bc-1" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(true);
			expect(parsed.broadcast).toEqual(broadcast);
			expect(mockBroadcasts.send).toHaveBeenCalledWith("bc-1");
		});

		it("returns error when broadcastId is missing", async () => {
			const result = await handleManageBroadcasts({ action: "send" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/broadcastId.*required/i);
		});
	});

	describe("error handling", () => {
		it("wraps SDK errors in isError response", async () => {
			mockBroadcasts.list.mockRejectedValue(new Error("Service unavailable"));

			const result = await handleManageBroadcasts({ action: "list" });
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain("Service unavailable");
			expect(result.isError).toBe(true);
		});

		it("handles unknown action gracefully", async () => {
			const result = await handleManageBroadcasts({ action: "archive" } as any);
			const parsed = parseResult(result) as any;

			expect(parsed.success).toBe(false);
			expect(parsed.error).toMatch(/unknown action/i);
			expect(result.isError).toBe(true);
		});
	});
});
