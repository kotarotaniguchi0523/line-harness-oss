import { ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsRpc } from "../friends.rpc.js";

const { createFriendQueriesMock, createFriendCommandsMock } = vi.hoisted(() => ({
	createFriendQueriesMock: vi.fn(),
	createFriendCommandsMock: vi.fn(),
}));

vi.mock("../../services/friend.service.js", () => ({
	createFriendService: (db: unknown) => ({
		queries: createFriendQueriesMock(db),
		commands: createFriendCommandsMock(db),
	}),
}));

describe("FriendsRpc safeParse validation", () => {
	const queries = {
		listFriends: vi.fn(),
		getFriend: vi.fn(),
		countFriends: vi.fn(),
	};

	const commands = {
		assignTag: vi.fn(),
		removeTag: vi.fn(),
	};

	const staff = { id: "staff-1", name: "Alice", role: "staff" };

	beforeEach(() => {
		for (const fn of Object.values(queries)) fn.mockReset();
		for (const fn of Object.values(commands)) fn.mockReset();
		createFriendQueriesMock.mockReset();
		createFriendCommandsMock.mockReset();
		createFriendQueriesMock.mockReturnValue(queries);
		createFriendCommandsMock.mockReturnValue(commands);
	});

	// -------------------------------------------------------------------------
	// 1. list with invalid page parameter should throw validation error
	// -------------------------------------------------------------------------
	it("list_invalidPage_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);

		// Act
		const act = rpc.list({ page: -1 });

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
		await expect(act).rejects.toThrow("page");
	});

	// -------------------------------------------------------------------------
	// 2. list with invalid tagId should throw UUID validation error
	// -------------------------------------------------------------------------
	it("list_invalidTagId_shouldThrowUuidValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);

		// Act
		const act = rpc.list({ tagId: "not-a-uuid" });

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
		await expect(act).rejects.toThrow("tagId");
	});

	// -------------------------------------------------------------------------
	// 3. get with invalid ID should throw validation error
	// -------------------------------------------------------------------------
	it("get_invalidId_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);

		// Act
		const act = rpc.get("invalid-id");

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// 4. assignTag with invalid friendId should throw validation error
	// -------------------------------------------------------------------------
	it("assignTag_invalidFriendId_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";

		// Act
		const act = rpc.assignTag("bad-friend-id", validUuid);

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// 5. assignTag with invalid tagId should throw validation error
	// -------------------------------------------------------------------------
	it("assignTag_invalidTagId_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";

		// Act
		const act = rpc.assignTag(validUuid, "bad-tag-id");

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// 6. count with invalid lineAccountId should throw validation error
	// -------------------------------------------------------------------------
	it("count_invalidLineAccountId_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);

		// Act
		const act = rpc.count("not-a-uuid");

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// Happy path: valid inputs should not throw
	// -------------------------------------------------------------------------
	it("list_validInput_shouldNotThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		queries.listFriends.mockResolvedValue(ok({ items: [], total: 0 }));

		// Act & Assert
		await expect(rpc.list({ page: 1, limit: 10 })).resolves.not.toThrow();
	});

	it("get_validUuid_shouldNotThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		queries.getFriend.mockResolvedValue(ok({ id: "550e8400-e29b-41d4-a716-446655440000" }));

		// Act & Assert
		await expect(rpc.get("550e8400-e29b-41d4-a716-446655440000")).resolves.not.toThrow();
	});

	it("assignTag_validUuids_shouldNotThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		commands.assignTag.mockResolvedValue(ok(undefined));
		const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
		const uuid2 = "660e8400-e29b-41d4-a716-446655440000";

		// Act & Assert
		await expect(rpc.assignTag(uuid1, uuid2)).resolves.not.toThrow();
	});

	it("count_validUuid_shouldNotThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		queries.countFriends.mockResolvedValue(ok(5));

		// Act & Assert
		await expect(rpc.count("550e8400-e29b-41d4-a716-446655440000")).resolves.not.toThrow();
	});

	it("count_noArg_shouldNotThrow", async () => {
		// Arrange
		const rpc = new FriendsRpc({} as never, staff);
		queries.countFriends.mockResolvedValue(ok(5));

		// Act & Assert
		await expect(rpc.count()).resolves.not.toThrow();
	});
});
