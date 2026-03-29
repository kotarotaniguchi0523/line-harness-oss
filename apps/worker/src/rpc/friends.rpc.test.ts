import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsRpc } from "./friends.rpc.js";

const { createFriendQueriesMock, createFriendCommandsMock } = vi.hoisted(() => ({
	createFriendQueriesMock: vi.fn(),
	createFriendCommandsMock: vi.fn(),
}));

vi.mock("../services/friend.service.js", () => ({
	createFriendService: (db: unknown) => ({
		queries: createFriendQueriesMock(db),
		commands: createFriendCommandsMock(db),
	}),
}));

describe("FriendsRpc", () => {
	const queries = {
		listFriends: vi.fn(),
		getFriend: vi.fn(),
		countFriends: vi.fn(),
	};

	const commands = {
		assignTag: vi.fn(),
		removeTag: vi.fn(),
	};

	const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
	const uuid2 = "660e8400-e29b-41d4-a716-446655440001";
	const _uuid3 = "770e8400-e29b-41d4-a716-446655440002";

	const staffContext = { id: "staff-1", name: "Alice", role: "staff" };
	const adminContext = { id: "admin-1", name: "Bob", role: "admin" };

	beforeEach(() => {
		for (const fn of Object.values(queries)) fn.mockReset();
		for (const fn of Object.values(commands)) fn.mockReset();
		createFriendQueriesMock.mockReset();
		createFriendCommandsMock.mockReset();
		createFriendQueriesMock.mockReturnValue(queries);
		createFriendCommandsMock.mockReturnValue(commands);
	});

	it("friendsRpc_list_shouldDelegateToQueries", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		queries.listFriends.mockResolvedValue(ok({ items: [], total: 0 }));

		// Act
		await rpc.list({ page: 2, limit: 10, tagId: uuid1, lineAccountId: uuid2, search: "ali" });

		// Assert
		expect(queries.listFriends).toHaveBeenCalledWith(staffContext, {
			page: 2,
			limit: 10,
			tagId: uuid1,
			lineAccountId: uuid2,
			search: "ali",
		});
	});

	it("friendsRpc_list_shouldCalculateHasNextPage", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		queries.listFriends.mockResolvedValue(ok({ items: [{ id: uuid1 }], total: 21 }));

		// Act
		const result = await rpc.list({ page: 1, limit: 20 });

		// Assert
		expect(result).toEqual({
			items: [{ id: uuid1 }],
			total: 21,
			page: 1,
			limit: 20,
			hasNextPage: true,
		});
	});

	it("friendsRpc_list_serviceError_shouldThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		queries.listFriends.mockResolvedValue(
			err({ code: "ACCOUNT_SCOPE_REQUIRED", message: "lineAccountId is required for list operations" }),
		);

		// Act & Assert
		await expect(rpc.list({ page: 1, limit: 20 })).rejects.toThrow("[ACCOUNT_SCOPE_REQUIRED]");
	});

	it("friendsRpc_get_existing_shouldReturnFriend", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		queries.getFriend.mockResolvedValue(ok({ id: uuid1 }));

		// Act
		const result = await rpc.get(uuid1);

		// Assert
		expect(result).toEqual({ id: uuid1 });
	});

	it("friendsRpc_get_notFound_shouldThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		queries.getFriend.mockResolvedValue(err({ code: "NOT_FOUND", message: "Friend not found" }));

		// Act & Assert
		await expect(rpc.get(uuid1)).rejects.toThrow("[NOT_FOUND]");
	});

	it("friendsRpc_assignTag_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, adminContext);
		commands.assignTag.mockResolvedValue(ok(undefined));

		// Act
		await rpc.assignTag(uuid1, uuid2);

		// Assert
		expect(commands.assignTag).toHaveBeenCalledWith(adminContext, {
			friendId: uuid1,
			tagId: uuid2,
		});
	});

	it("friendsRpc_assignTag_forbidden_shouldThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		commands.assignTag.mockResolvedValue(
			err({ code: "FORBIDDEN", message: "Only owner or admin can modify friend data" }),
		);

		// Act & Assert
		await expect(rpc.assignTag(uuid1, uuid2)).rejects.toThrow("[FORBIDDEN]");
	});

	it("friendsRpc_removeTag_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, adminContext);
		commands.removeTag.mockResolvedValue(ok(undefined));

		// Act
		await rpc.removeTag(uuid1, uuid2);

		// Assert
		expect(commands.removeTag).toHaveBeenCalledWith(adminContext, {
			friendId: uuid1,
			tagId: uuid2,
		});
	});

	it("friendsRpc_count_shouldDelegateToQueries", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);
		queries.countFriends.mockResolvedValue(ok(42));

		// Act
		const result = await rpc.count(uuid1);

		// Assert
		expect(result).toBe(42);
		expect(queries.countFriends).toHaveBeenCalledWith(staffContext, uuid1);
	});

	it("friendsRpc_list_invalidInput_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);

		// Act & Assert
		await expect(rpc.list({ page: -1 })).rejects.toThrow("Validation failed");
	});

	it("friendsRpc_get_invalidUuid_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staffContext);

		// Act & Assert
		await expect(rpc.get("not-a-uuid")).rejects.toThrow("Validation failed");
	});
});
