import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../../src/http.js";
import { FriendsResource } from "../../src/resources/friends.js";

function mockHttp(overrides: Partial<HttpClient> = {}): HttpClient {
	return {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		...overrides,
	} as unknown as HttpClient;
}

describe("FriendsResource", () => {
	it("list() no params calls GET /api/friends", async () => {
		const paginatedData = {
			items: [
				{
					id: "1",
					lineUserId: "U123",
					displayName: "Alice",
					pictureUrl: null,
					statusMessage: null,
					isFollowing: true,
					tags: [],
					createdAt: "2026-03-21",
					updatedAt: "2026-03-21",
				},
			],
			total: 1,
			page: 1,
			limit: 50,
			hasNextPage: false,
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: paginatedData }) });
		const resource = new FriendsResource(http);
		const result = await resource.list();
		expect(http.get).toHaveBeenCalledWith("/api/friends");
		expect(result).toEqual(paginatedData);
	});

	it("list() with params calls GET /api/friends?limit=10&offset=20&tagId=x", async () => {
		const paginatedData = {
			items: [],
			total: 0,
			page: 1,
			limit: 10,
			hasNextPage: false,
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: paginatedData }) });
		const resource = new FriendsResource(http);
		const result = await resource.list({ limit: 10, offset: 20, tagId: "x" });
		expect(http.get).toHaveBeenCalledWith("/api/friends?limit=10&offset=20&tagId=x");
		expect(result).toEqual(paginatedData);
	});

	it("get() calls GET /api/friends/:id", async () => {
		const friend = {
			id: "1",
			lineUserId: "U123",
			displayName: "Alice",
			pictureUrl: null,
			statusMessage: null,
			isFollowing: true,
			tags: [],
			createdAt: "2026-03-21",
			updatedAt: "2026-03-21",
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: friend }) });
		const resource = new FriendsResource(http);
		const result = await resource.get("friend-1");
		expect(http.get).toHaveBeenCalledWith("/api/friends/friend-1");
		expect(result).toEqual(friend);
	});

	it("count() calls GET /api/friends/count and returns plain number", async () => {
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: { count: 42 } }) });
		const resource = new FriendsResource(http);
		const result = await resource.count();
		expect(http.get).toHaveBeenCalledWith("/api/friends/count");
		expect(result).toEqual(42);
	});

	it("addTag() calls POST /api/friends/:id/tags with { tagId }", async () => {
		const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: null }) });
		const resource = new FriendsResource(http);
		await resource.addTag("friend-1", "tag-1");
		expect(http.post).toHaveBeenCalledWith("/api/friends/friend-1/tags", { tagId: "tag-1" });
	});

	it("removeTag() calls DELETE /api/friends/:id/tags/:tagId", async () => {
		const http = mockHttp({ delete: vi.fn().mockResolvedValue({ success: true, data: null }) });
		const resource = new FriendsResource(http);
		await resource.removeTag("friend-1", "tag-1");
		expect(http.delete).toHaveBeenCalledWith("/api/friends/friend-1/tags/tag-1");
	});

	it("list() with accountId uses lineAccountId query parameter", async () => {
		const paginatedData = {
			items: [],
			total: 0,
			page: 1,
			limit: 50,
			hasNextPage: false,
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: paginatedData }) });
		const resource = new FriendsResource(http);
		await resource.list({ accountId: "acc-1" });
		expect(http.get).toHaveBeenCalledWith("/api/friends?lineAccountId=acc-1");
	});

	it("list() uses defaultAccountId when no explicit accountId is given", async () => {
		const paginatedData = {
			items: [],
			total: 0,
			page: 1,
			limit: 50,
			hasNextPage: false,
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: paginatedData }) });
		const resource = new FriendsResource(http, "default-acc");
		await resource.list();
		expect(http.get).toHaveBeenCalledWith("/api/friends?lineAccountId=default-acc");
	});

	it("list() explicit accountId overrides defaultAccountId", async () => {
		const paginatedData = {
			items: [],
			total: 0,
			page: 1,
			limit: 50,
			hasNextPage: false,
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: paginatedData }) });
		const resource = new FriendsResource(http, "default-acc");
		await resource.list({ accountId: "override-acc" });
		expect(http.get).toHaveBeenCalledWith("/api/friends?lineAccountId=override-acc");
	});

	it("list() with all params builds correct query string", async () => {
		const paginatedData = {
			items: [],
			total: 0,
			page: 1,
			limit: 10,
			hasNextPage: false,
		};
		const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: paginatedData }) });
		const resource = new FriendsResource(http);
		await resource.list({ limit: 10, offset: 20, tagId: "tag-1", accountId: "acc-1" });
		const calledUrl = (http.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		const url = new URL(calledUrl, "https://dummy");
		expect(url.searchParams.get("limit")).toBe("10");
		expect(url.searchParams.get("offset")).toBe("20");
		expect(url.searchParams.get("tagId")).toBe("tag-1");
		expect(url.searchParams.get("lineAccountId")).toBe("acc-1");
	});

	it("sendMessage() calls POST /api/friends/:id/messages", async () => {
		const messageResult = { messageId: "msg-1" };
		const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: messageResult }) });
		const resource = new FriendsResource(http);
		const result = await resource.sendMessage("friend-1", "Hello!");
		expect(http.post).toHaveBeenCalledWith("/api/friends/friend-1/messages", {
			messageType: "text",
			content: "Hello!",
		});
		expect(result).toEqual(messageResult);
	});

	it("sendMessage() with custom messageType", async () => {
		const messageResult = { messageId: "msg-2" };
		const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: messageResult }) });
		const resource = new FriendsResource(http);
		await resource.sendMessage("friend-1", '{"type":"bubble"}', "flex");
		expect(http.post).toHaveBeenCalledWith("/api/friends/friend-1/messages", {
			messageType: "flex",
			content: '{"type":"bubble"}',
		});
	});

	it("setMetadata() calls PUT /api/friends/:id/metadata with fields", async () => {
		const friend = {
			id: "friend-1",
			lineUserId: "U123",
			displayName: "Alice",
			pictureUrl: null,
			statusMessage: null,
			isFollowing: true,
			metadata: { plan: "premium", age: 30 },
			tags: [],
			createdAt: "2026-03-21",
			updatedAt: "2026-03-21",
		};
		const http = mockHttp({ put: vi.fn().mockResolvedValue({ success: true, data: friend }) });
		const resource = new FriendsResource(http);
		const result = await resource.setMetadata("friend-1", { plan: "premium", age: 30 });
		expect(http.put).toHaveBeenCalledWith("/api/friends/friend-1/metadata", { plan: "premium", age: 30 });
		expect(result.metadata).toEqual({ plan: "premium", age: 30 });
	});

	it("setRichMenu() calls POST /api/friends/:id/rich-menu", async () => {
		const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: null }) });
		const resource = new FriendsResource(http);
		await resource.setRichMenu("friend-1", "rm-1");
		expect(http.post).toHaveBeenCalledWith("/api/friends/friend-1/rich-menu", { richMenuId: "rm-1" });
	});

	it("removeRichMenu() calls DELETE /api/friends/:id/rich-menu", async () => {
		const http = mockHttp({ delete: vi.fn().mockResolvedValue({ success: true, data: null }) });
		const resource = new FriendsResource(http);
		await resource.removeRichMenu("friend-1");
		expect(http.delete).toHaveBeenCalledWith("/api/friends/friend-1/rich-menu");
	});
});
