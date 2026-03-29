import { beforeEach, describe, expect, it, vi } from "vitest";
import { LineApiClient } from "./client.js";

const fetchMock = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", fetchMock);

describe("LineApiClient", () => {
	beforeEach(() => {
		fetchMock.mockReset();
	});

	it("lineApiClient_pushMessage_validMessage_shouldCallFetch", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		const messages = [{ type: "text", text: "hello" }] as const;
		fetchMock.mockResolvedValue(createResponse({ status: 200 }));

		// Act
		await client.pushMessage("user-1", [...messages]);

		// Assert
		expect(fetchMock).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", {
			method: "POST",
			body: JSON.stringify({ to: "user-1", messages }),
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer test-token",
			},
		});
	});

	it("lineApiClient_pushMessage_shouldValidateWithZod", async () => {
		// Arrange
		const client = new LineApiClient("test-token");

		// Act
		const result = await client.pushMessage("user-1", [{ type: "text", text: "" }]);

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("lineApiClient_pushMessage_apiError_shouldReturnError", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		fetchMock.mockResolvedValue(
			createResponse({
				status: 500,
				json: { message: "boom" },
			}),
		);

		// Act
		const result = await client.pushMessage("user-1", [{ type: "text", text: "hello" }]);

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 500");
		}
	});

	it("lineApiClient_replyMessage_shouldSendWithReplyToken", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		fetchMock.mockResolvedValue(createResponse({ status: 200 }));

		// Act
		await client.replyMessage("reply-token", [{ type: "text", text: "hello" }]);

		// Assert
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.line.me/v2/bot/message/reply",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					replyToken: "reply-token",
					messages: [{ type: "text", text: "hello" }],
				}),
			}),
		);
	});

	it("lineApiClient_multicast_shouldSendTo500Max", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		const recipients = Array.from({ length: 501 }, (_, index) => `user-${index}`);

		// Act
		const result = await client.multicast(recipients, [{ type: "text", text: "hello" }]);

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("lineApiClient_broadcast_shouldSendBroadcast", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		fetchMock.mockResolvedValue(createResponse({ status: 200 }));

		// Act
		await client.broadcast([{ type: "text", text: "hello" }]);

		// Assert
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.line.me/v2/bot/message/broadcast",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					messages: [{ type: "text", text: "hello" }],
				}),
			}),
		);
	});

	it("lineApiClient_getProfile_shouldReturnParsedProfile", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		const profileData = {
			displayName: "Alice",
			userId: "user-1",
			pictureUrl: "https://example.com/avatar.png",
			statusMessage: "hello",
			language: "ja",
		};
		fetchMock.mockResolvedValue(
			createResponse({
				status: 200,
				json: profileData,
			}),
		);

		// Act
		const result = await client.getProfile("user-1");

		// Assert
		expect(result).toEqual({ ok: true, data: profileData });
	});

	it("lineApiClient_getProfile_notFound_shouldReturnError", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		fetchMock.mockResolvedValue(
			createResponse({
				status: 404,
				json: { message: "not found" },
			}),
		);

		// Act
		const result = await client.getProfile("missing-user");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 404");
		}
	});

	it("lineApiClient_getRichMenuList_shouldReturnArray", async () => {
		// Arrange
		const client = new LineApiClient("test-token");
		fetchMock.mockResolvedValue(
			createResponse({
				status: 200,
				json: {
					richmenus: [{ richMenuId: "rm-1" }, { richMenuId: "rm-2" }],
				},
			}),
		);

		// Act
		const result = await client.getRichMenuList();

		// Assert
		expect(result).toEqual({
			ok: true,
			data: [{ richMenuId: "rm-1" }, { richMenuId: "rm-2" }],
		});
	});
});

function createResponse({ status, json, text }: { status: number; json?: unknown; text?: string }): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: vi.fn().mockResolvedValue(json),
		text: vi.fn().mockResolvedValue(text ?? JSON.stringify(json)),
	} as unknown as Response;
}
