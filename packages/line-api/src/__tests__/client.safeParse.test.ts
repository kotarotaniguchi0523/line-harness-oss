import { beforeEach, describe, expect, it, vi } from "vitest";
import { LineApiClient } from "../client.js";

// ---------------------------------------------------------------------------
// Mock fetch at the global level -- LINE API is the external boundary
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
global.fetch = mockFetch;

const client = new LineApiClient("test-access-token");

beforeEach(() => {
	mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------
describe("getProfile", () => {
	it("getProfile_正常レスポンス_パース成功", async () => {
		// Arrange
		const profile = {
			displayName: "Taro",
			userId: "U1234567890abcdef",
			pictureUrl: "https://example.com/pic.png",
			statusMessage: "Hello",
			language: "ja",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200 }));

		// Act
		const result = await client.getProfile("U1234567890abcdef");

		// Assert
		expect(result).toEqual({ ok: true, data: profile });
		expect(mockFetch).toHaveBeenCalledOnce();
	});

	it("getProfile_不正レスポンス_パースエラー", async () => {
		// Arrange -- displayName is required but missing
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ userId: 12345 }), { status: 200 }));

		// Act
		const result = await client.getProfile("U1234567890abcdef");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});

	it("getProfile_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));

		// Act
		const result = await client.getProfile("U_invalid");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 404");
		}
	});
});

// ---------------------------------------------------------------------------
// pushMessage
// ---------------------------------------------------------------------------
describe("pushMessage", () => {
	it("pushMessage_不正メッセージ型_バリデーションエラー", async () => {
		// Arrange -- invalid message: missing required fields
		const badMessages = [{ type: "image" }] as any;

		// Act
		const result = await client.pushMessage("U123", badMessages);

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		// fetch should NOT be called when request validation fails
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// getRichMenuList
// ---------------------------------------------------------------------------
describe("getRichMenuList", () => {
	it("getRichMenuList_空配列_成功結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ richmenus: [] }), { status: 200 }));

		// Act
		const result = await client.getRichMenuList();

		// Assert
		expect(result).toEqual({ ok: true, data: [] });
	});

	it("getRichMenuList_不正構造_パースエラー", async () => {
		// Arrange -- response is not { richmenus: [...] }
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ menus: [] }), { status: 200 }));

		// Act
		const result = await client.getRichMenuList();

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});
});

// ---------------------------------------------------------------------------
// narrowcast
// ---------------------------------------------------------------------------
describe("narrowcast", () => {
	it("narrowcast_正常リクエスト_requestIdを返す", async () => {
		// Arrange -- 202 Accepted with x-line-request-id header
		const headers = new Headers();
		headers.set("x-line-request-id", "req-abc-123");
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200, headers }));

		// Act
		const result = await client.narrowcast({
			messages: [{ type: "text", text: "Hello narrowcast" }],
			demographic: {
				type: "operator",
				and: [{ type: "gender", oneOf: ["male"] }],
			},
		});

		// Assert
		expect(result).toEqual({ ok: true, data: { requestId: "req-abc-123" } });
		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/message/narrowcast");
		expect(init.method).toBe("POST");
	});

	it("narrowcast_空メッセージ配列_バリデーションエラー", async () => {
		// Arrange -- messages must have at least 1 item
		const result = await client.narrowcast({ messages: [] });

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("narrowcast_recipient付き_正常送信", async () => {
		// Arrange
		const headers = new Headers();
		headers.set("x-line-request-id", "req-with-audience");
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200, headers }));

		// Act
		const result = await client.narrowcast({
			messages: [{ type: "text", text: "Audience test" }],
			recipient: {
				type: "operator",
				and: [{ type: "audience", audienceGroupId: 12345 }],
			},
			limit: { max: 100, upToRemainingQuota: true },
		});

		// Assert
		expect(result).toEqual({ ok: true, data: { requestId: "req-with-audience" } });
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.recipient.and[0].audienceGroupId).toBe(12345);
		expect(body.limit.max).toBe(100);
	});

	it("narrowcast_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Too many requests" }), { status: 429 }));

		// Act
		const result = await client.narrowcast({
			messages: [{ type: "text", text: "Rate limited" }],
		});

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 429");
		}
	});
});

// ---------------------------------------------------------------------------
// Audience Management
// ---------------------------------------------------------------------------
describe("createUploadAudience", () => {
	it("createUploadAudience_正常レスポンス_パース成功", async () => {
		// Arrange
		const responseBody = { audienceGroupId: 99001, created: "2026-03-27T10:00:00Z" };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }));

		// Act
		const result = await client.createUploadAudience({
			description: "Test audience",
			audiences: [{ id: "U001" }, { id: "U002" }],
		});

		// Assert
		expect(result).toEqual({ ok: true, data: responseBody });
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/audienceGroup/upload");
		expect(init.method).toBe("POST");
	});

	it("createUploadAudience_空description_バリデーションエラー", async () => {
		// Arrange -- description must be at least 1 char
		const result = await client.createUploadAudience({
			description: "",
			audiences: [{ id: "U001" }],
		});

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe("addToUploadAudience", () => {
	it("addToUploadAudience_正常リクエスト_成功", async () => {
		// Arrange -- PUT returns 200 with empty body
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		// Act
		const result = await client.addToUploadAudience({
			audienceGroupId: 99001,
			audiences: [{ id: "U003" }],
		});

		// Assert
		expect(result.ok).toBe(true);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/audienceGroup/upload");
		expect(init.method).toBe("PUT");
	});

	it("addToUploadAudience_空audiences_バリデーションエラー", async () => {
		// Arrange
		const result = await client.addToUploadAudience({
			audienceGroupId: 99001,
			audiences: [],
		});

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe("createClickAudience", () => {
	it("createClickAudience_正常レスポンス_パース成功", async () => {
		// Arrange
		const responseBody = { audienceGroupId: 99002, created: "2026-03-27T11:00:00Z" };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }));

		// Act
		const result = await client.createClickAudience({
			description: "Click audience",
			requestId: "req-abc-123",
			clickUrl: "https://example.com/landing",
		});

		// Assert
		expect(result).toEqual({ ok: true, data: responseBody });
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.clickUrl).toBe("https://example.com/landing");
	});

	it("createClickAudience_requestId欠落_バリデーションエラー", async () => {
		// Arrange
		const result = await client.createClickAudience({
			description: "Click audience",
			requestId: "",
		});

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Request validation failed");
		}
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe("createImpressionAudience", () => {
	it("createImpressionAudience_正常レスポンス_パース成功", async () => {
		// Arrange
		const responseBody = { audienceGroupId: 99003, created: "2026-03-27T12:00:00Z" };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }));

		// Act
		const result = await client.createImpressionAudience({
			description: "Impression audience",
			requestId: "req-def-456",
		});

		// Assert
		expect(result).toEqual({ ok: true, data: responseBody });
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/audienceGroup/imp");
		expect(init.method).toBe("POST");
	});
});

describe("getAudience", () => {
	it("getAudience_正常レスポンス_audienceGroupを返す", async () => {
		// Arrange
		const audienceGroup = {
			audienceGroupId: 99001,
			type: "UPLOAD",
			description: "Test audience",
			status: "READY",
			audienceCount: 150,
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ audienceGroup }), { status: 200 }));

		// Act
		const result = await client.getAudience(99001);

		// Assert
		expect(result).toEqual({ ok: true, data: audienceGroup });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/audienceGroup/99001");
	});

	it("getAudience_不正レスポンス_パースエラー", async () => {
		// Arrange -- missing required audienceGroup wrapper
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ invalid: true }), { status: 200 }));

		// Act
		const result = await client.getAudience(99001);

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});
});

describe("listAudiences", () => {
	it("listAudiences_正常レスポンス_一覧を返す", async () => {
		// Arrange
		const responseBody = {
			audienceGroups: [
				{
					audienceGroupId: 99001,
					type: "UPLOAD",
					description: "Audience A",
					status: "READY",
				},
			],
			totalCount: 1,
			page: 1,
			size: 40,
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }));

		// Act
		const result = await client.listAudiences({ page: 1, size: 40 });

		// Assert
		expect(result).toEqual({ ok: true, data: responseBody });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("page=1");
		expect(url).toContain("size=40");
	});

	it("listAudiences_パラメータなし_クエリ文字列なし", async () => {
		// Arrange
		const responseBody = { audienceGroups: [], totalCount: 0 };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }));

		// Act
		const result = await client.listAudiences();

		// Assert
		expect(result).toEqual({ ok: true, data: responseBody });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/audienceGroup/list");
		expect(url).not.toContain("?");
	});

	it("listAudiences_status指定_クエリに含まれる", async () => {
		// Arrange
		const responseBody = { audienceGroups: [], totalCount: 0 };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }));

		// Act
		const result = await client.listAudiences({ status: "READY" });

		// Assert
		expect(result.ok).toBe(true);
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("status=READY");
	});
});

describe("deleteAudience", () => {
	it("deleteAudience_正常リクエスト_成功", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		// Act
		const result = await client.deleteAudience(99001);

		// Assert
		expect(result.ok).toBe(true);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/audienceGroup/99001");
		expect(init.method).toBe("DELETE");
	});

	it("deleteAudience_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));

		// Act
		const result = await client.deleteAudience(99999);

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 404");
		}
	});
});

// ---------------------------------------------------------------------------
// Message Delivery Results
// ---------------------------------------------------------------------------
describe("getMessageDeliveryBroadcast", () => {
	it("getMessageDeliveryBroadcast_正常レスポンス_パース成功", async () => {
		// Arrange
		const delivery = { status: "ready", success: 1000, failure: 5, rate_limited: 0 };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(delivery), { status: 200 }));

		// Act
		const result = await client.getMessageDeliveryBroadcast("20260327");

		// Assert
		expect(result).toEqual({ ok: true, data: delivery });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/message/delivery/broadcast?date=20260327");
	});

	it("getMessageDeliveryBroadcast_unreadyステータス_パース成功", async () => {
		// Arrange
		const delivery = { status: "unready" };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(delivery), { status: 200 }));

		// Act
		const result = await client.getMessageDeliveryBroadcast("20260327");

		// Assert
		expect(result).toEqual({ ok: true, data: delivery });
	});

	it("getMessageDeliveryBroadcast_不正status_パースエラー", async () => {
		// Arrange -- status must be one of the enum values
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: "unknown_status" }), { status: 200 }));

		// Act
		const result = await client.getMessageDeliveryBroadcast("20260327");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});
});

describe("getMessageDeliveryPush", () => {
	it("getMessageDeliveryPush_正常レスポンス_パース成功", async () => {
		// Arrange
		const delivery = { status: "ready", success: 500, failure: 2 };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(delivery), { status: 200 }));

		// Act
		const result = await client.getMessageDeliveryPush("20260327");

		// Assert
		expect(result).toEqual({ ok: true, data: delivery });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/message/delivery/push?date=20260327");
	});

	it("getMessageDeliveryPush_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }));

		// Act
		const result = await client.getMessageDeliveryPush("20260327");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 403");
		}
	});
});

// ---------------------------------------------------------------------------
// Group Management
// ---------------------------------------------------------------------------
describe("getGroupSummary", () => {
	it("getGroupSummary_正常レスポンス_パース成功", async () => {
		// Arrange
		const summary = {
			groupId: "C4af4980629...",
			groupName: "テストグループ",
			pictureUrl: "https://profile.line-scdn.net/abc123",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(summary), { status: 200 }));

		// Act
		const result = await client.getGroupSummary("C4af4980629...");

		// Assert
		expect(result).toEqual({ ok: true, data: summary });
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/group/C4af4980629.../summary");
		expect(init.method).toBe("GET");
	});

	it("getGroupSummary_pictureUrlなし_パース成功", async () => {
		// Arrange -- pictureUrl is optional
		const summary = {
			groupId: "Cabcdef12345",
			groupName: "アイコンなしグループ",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(summary), { status: 200 }));

		// Act
		const result = await client.getGroupSummary("Cabcdef12345");

		// Assert
		expect(result).toEqual({ ok: true, data: summary });
	});

	it("getGroupSummary_groupName欠落_パースエラー", async () => {
		// Arrange -- groupName is required
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ groupId: "C123" }), { status: 200 }));

		// Act
		const result = await client.getGroupSummary("C123");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});

	it("getGroupSummary_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));

		// Act
		const result = await client.getGroupSummary("C_invalid");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 404");
		}
	});
});

describe("getGroupMemberIds", () => {
	it("getGroupMemberIds_正常レスポンス_パース成功", async () => {
		// Arrange
		const membersResponse = {
			memberUserIds: ["U001", "U002", "U003"],
			next: "continuationToken123",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }));

		// Act
		const result = await client.getGroupMemberIds("Cgroup123");

		// Assert
		expect(result).toEqual({ ok: true, data: membersResponse });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/group/Cgroup123/members/ids");
		expect(url).not.toContain("start=");
	});

	it("getGroupMemberIds_最終ページ_nextなし", async () => {
		// Arrange -- last page has no next token
		const membersResponse = {
			memberUserIds: ["U004", "U005"],
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }));

		// Act
		const result = await client.getGroupMemberIds("Cgroup123");

		// Assert
		expect(result).toEqual({ ok: true, data: membersResponse });
	});

	it("getGroupMemberIds_continuationToken付き_クエリパラメータに含まれる", async () => {
		// Arrange
		const membersResponse = { memberUserIds: ["U006"] };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }));

		// Act
		const result = await client.getGroupMemberIds("Cgroup123", "tokenABC");

		// Assert
		expect(result.ok).toBe(true);
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("start=tokenABC");
	});

	it("getGroupMemberIds_不正レスポンス_パースエラー", async () => {
		// Arrange -- missing memberUserIds field
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: ["U001"] }), { status: 200 }));

		// Act
		const result = await client.getGroupMemberIds("Cgroup123");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});
});

describe("getGroupMemberProfile", () => {
	it("getGroupMemberProfile_正常レスポンス_パース成功", async () => {
		// Arrange
		const profile = {
			displayName: "グループメンバー太郎",
			userId: "U001",
			pictureUrl: "https://example.com/member.png",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200 }));

		// Act
		const result = await client.getGroupMemberProfile("Cgroup123", "U001");

		// Assert
		expect(result).toEqual({ ok: true, data: profile });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/group/Cgroup123/member/U001");
	});

	it("getGroupMemberProfile_displayName欠落_パースエラー", async () => {
		// Arrange -- displayName is required in UserProfileSchema
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ userId: "U001" }), { status: 200 }));

		// Act
		const result = await client.getGroupMemberProfile("Cgroup123", "U001");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Response validation failed");
		}
	});

	it("getGroupMemberProfile_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }));

		// Act
		const result = await client.getGroupMemberProfile("Cgroup123", "U_invalid");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 403");
		}
	});
});

describe("leaveGroup", () => {
	it("leaveGroup_正常リクエスト_成功", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		// Act
		const result = await client.leaveGroup("Cgroup123");

		// Assert
		expect(result.ok).toBe(true);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/group/Cgroup123/leave");
		expect(init.method).toBe("POST");
	});

	it("leaveGroup_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));

		// Act
		const result = await client.leaveGroup("C_invalid");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 404");
		}
	});
});

// ---------------------------------------------------------------------------
// Room Management
// ---------------------------------------------------------------------------
describe("getRoomMemberIds", () => {
	it("getRoomMemberIds_正常レスポンス_パース成功", async () => {
		// Arrange
		const membersResponse = {
			memberUserIds: ["U101", "U102"],
			next: "roomContinuationToken",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }));

		// Act
		const result = await client.getRoomMemberIds("Rroom456");

		// Assert
		expect(result).toEqual({ ok: true, data: membersResponse });
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("/room/Rroom456/members/ids");
	});

	it("getRoomMemberIds_continuationToken付き_クエリパラメータに含まれる", async () => {
		// Arrange
		const membersResponse = { memberUserIds: ["U103"] };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }));

		// Act
		const result = await client.getRoomMemberIds("Rroom456", "pageToken");

		// Assert
		expect(result.ok).toBe(true);
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("start=pageToken");
	});

	it("getRoomMemberIds_空メンバー_パース成功", async () => {
		// Arrange -- group with no members (edge case)
		const membersResponse = { memberUserIds: [] };
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }));

		// Act
		const result = await client.getRoomMemberIds("Rroom456");

		// Assert
		expect(result).toEqual({ ok: true, data: membersResponse });
	});

	it("getRoomMemberIds_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }));

		// Act
		const result = await client.getRoomMemberIds("R_invalid");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 403");
		}
	});
});

describe("leaveRoom", () => {
	it("leaveRoom_正常リクエスト_成功", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		// Act
		const result = await client.leaveRoom("Rroom456");

		// Assert
		expect(result.ok).toBe(true);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("/room/Rroom456/leave");
		expect(init.method).toBe("POST");
	});

	it("leaveRoom_HTTPエラー_エラー結果を返す", async () => {
		// Arrange
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));

		// Act
		const result = await client.leaveRoom("R_invalid");

		// Assert
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("LINE API Error 404");
		}
	});
});
