import type { FriendId, LineAccountId, LineUserId, TagId } from "@line-crm/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { friends, friendTags, tags } from "../schema/index.js";
import { createFriendRepository } from "./friend.repository.js";

vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof import("drizzle-orm")>();
	const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		kind: "sql",
		strings: Array.from(strings),
		values,
	}));

	return {
		...actual,
		eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
		and: vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions })),
		isNull: vi.fn((value: unknown) => ({ kind: "isNull", value })),
		desc: vi.fn((value: unknown) => ({ kind: "desc", value })),
		asc: vi.fn((value: unknown) => ({ kind: "asc", value })),
		like: vi.fn((left: unknown, right: unknown) => ({ kind: "like", left, right })),
		sql: Object.assign(sqlMock, {
			join: vi.fn((items: unknown[], separator: unknown) => ({ kind: "join", items, separator })),
		}),
	};
});

function createSelectWhereChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(result),
	};
}

function _createSelectWhereOrderChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue(result),
	};
}

function createSelectWhereOrderLimitChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockResolvedValue(result),
	};
}

function createSelectJoinWhereChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(result),
	};
}

function createInsertValuesChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

function createInsertConflictChain() {
	return {
		values: vi.fn().mockReturnValue({
			onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

function createUpdateChain() {
	return {
		set: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(undefined),
	};
}

function createDeleteChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

function buildFriend(id: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		lineUserId: `${id}-line`,
		displayName: `${id}-name`,
		pictureUrl: `${id}-picture`,
		statusMessage: `${id}-status`,
		isFollowing: 1,
		userId: `${id}-user`,
		score: 0,
		metadata: null,
		lineAccountId: "account-1",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		deletedAt: null,
		...overrides,
	};
}

describe("FriendRepository", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe("listWithTags", () => {
		it("friendRepo_listWithTags_emptyDb_shouldReturnEmptyItems", async () => {
			const countChain = createSelectWhereChain([{ count: 0 }]);
			const friendsChain = createSelectWhereOrderLimitChain([]);
			const db = {
				select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(friendsChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.listWithTags({ page: 1, limit: 20 });

			expect(result).toEqual({ items: [], total: 0 });
			expect(db.select).toHaveBeenCalledTimes(2);
			expect(countChain.where).toHaveBeenCalledTimes(1);
			expect(friendsChain.offset).toHaveBeenCalledWith(0);
		});

		it("friendRepo_listWithTags_withFriends_shouldReturnWithTags", async () => {
			const friendRows = [buildFriend("friend-1"), buildFriend("friend-2", { isFollowing: 0 })];
			const tagRows = [
				{ friendId: "friend-1", tagId: "tag-1", tagName: "VIP", tagColor: "#111111" },
				{ friendId: "friend-1", tagId: "tag-2", tagName: "Repeat", tagColor: "#222222" },
			];
			const countChain = createSelectWhereChain([{ count: 2 }]);
			const friendsChain = createSelectWhereOrderLimitChain(friendRows);
			const tagsChain = createSelectJoinWhereChain(tagRows);
			const db = {
				select: vi
					.fn()
					.mockReturnValueOnce(countChain)
					.mockReturnValueOnce(friendsChain)
					.mockReturnValueOnce(tagsChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.listWithTags({ page: 1, limit: 20 });

			expect(result).toEqual({
				items: [
					{
						...friendRows[0],
						isFollowing: true,
						tags: [
							{ id: "tag-1", name: "VIP", color: "#111111" },
							{ id: "tag-2", name: "Repeat", color: "#222222" },
						],
					},
					{
						...friendRows[1],
						isFollowing: false,
						tags: [],
					},
				],
				total: 2,
			});
			expect(db.select).toHaveBeenCalledTimes(3);
			expect(tagsChain.innerJoin).toHaveBeenCalledWith(tags, expect.anything());
		});

		it("friendRepo_listWithTags_tagFilter_shouldFilterByTag", async () => {
			const taggedFriendsChain = createSelectWhereChain([{ friendId: "friend-1" }]);
			const countChain = createSelectWhereChain([{ count: 1 }]);
			const friendsChain = createSelectWhereOrderLimitChain([buildFriend("friend-1")]);
			const tagsChain = createSelectJoinWhereChain([
				{ friendId: "friend-1", tagId: "tag-1", tagName: "VIP", tagColor: "#111111" },
			]);
			const db = {
				select: vi
					.fn()
					.mockReturnValueOnce(taggedFriendsChain)
					.mockReturnValueOnce(countChain)
					.mockReturnValueOnce(friendsChain)
					.mockReturnValueOnce(tagsChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.listWithTags({ page: 1, limit: 20, tagId: "tag-1" as TagId });

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.id).toBe("friend-1");
			expect(result.total).toBe(1);
			const whereArgument = friendsChain.where.mock.calls[0]?.[0] as { kind: string; conditions: unknown[] };
			expect(whereArgument.kind).toBe("and");
			expect(whereArgument.conditions[0]).toEqual(
				expect.objectContaining({
					kind: "isNull",
					value: friends.deletedAt,
				}),
			);
			const tagFilterCondition = whereArgument.conditions[1] as {
				kind: string;
				values: [unknown, { items: Array<{ values: [string] }> }];
			};
			expect(tagFilterCondition.kind).toBe("sql");
			expect(tagFilterCondition.values[1].items[0]?.values[0]).toBe("friend-1");
		});

		it("friendRepo_listWithTags_pagination_shouldRespectLimitOffset", async () => {
			const countChain = createSelectWhereChain([{ count: 5 }]);
			const friendsChain = createSelectWhereOrderLimitChain([buildFriend("friend-3")]);
			const tagsChain = createSelectJoinWhereChain([]);
			const db = {
				select: vi
					.fn()
					.mockReturnValueOnce(countChain)
					.mockReturnValueOnce(friendsChain)
					.mockReturnValueOnce(tagsChain),
			};
			const repository = createFriendRepository(db as never);

			await repository.listWithTags({ page: 3, limit: 2 });

			expect(friendsChain.limit).toHaveBeenCalledWith(2);
			expect(friendsChain.offset).toHaveBeenCalledWith(4);
		});

		it("friendRepo_listWithTags_accountFilter_shouldFilterByAccount", async () => {
			const countChain = createSelectWhereChain([{ count: 1 }]);
			const friendsChain = createSelectWhereOrderLimitChain([]);
			const db = {
				select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(friendsChain),
			};
			const repository = createFriendRepository(db as never);

			await repository.listWithTags({ page: 1, limit: 20, lineAccountId: "account-2" as LineAccountId });

			expect(countChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: friends.lineAccountId, right: "account-2" }),
					]),
				}),
			);
		});
	});

	describe("findById", () => {
		it("friendRepo_findById_existing_shouldReturnWithTags", async () => {
			const friendChain = createSelectWhereChain([buildFriend("friend-1")]);
			const tagsChain = createSelectJoinWhereChain([{ id: "tag-1", name: "VIP", color: "#111111" }]);
			const db = {
				select: vi.fn().mockReturnValueOnce(friendChain).mockReturnValueOnce(tagsChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.findById("friend-1" as FriendId);

			expect(result).toEqual({
				...buildFriend("friend-1"),
				isFollowing: true,
				tags: [{ id: "tag-1", name: "VIP", color: "#111111" }],
			});
		});

		it("friendRepo_findById_notFound_shouldReturnNull", async () => {
			const friendChain = createSelectWhereChain([]);
			const db = {
				select: vi.fn().mockReturnValueOnce(friendChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.findById("missing" as FriendId);

			expect(result).toBeNull();
			expect(db.select).toHaveBeenCalledTimes(1);
		});
	});

	describe("upsert", () => {
		it("friendRepo_upsert_newFriend_shouldInsert", async () => {
			const selectChain = createSelectWhereChain([]);
			const insertChain = createInsertValuesChain();
			const db = {
				select: vi.fn().mockReturnValueOnce(selectChain),
				insert: vi.fn().mockReturnValueOnce(insertChain),
			};
			const repository = createFriendRepository(db as never);
			const randomUUID = vi.fn().mockReturnValue("friend-new");
			vi.stubGlobal("crypto", { randomUUID });

			const result = await repository.upsert({
				lineUserId: "line-user-1" as LineUserId,
				displayName: "New Friend",
				pictureUrl: "https://example.com/picture.png",
				statusMessage: "hello",
				lineAccountId: "account-1" as LineAccountId,
			});

			expect(result).toBe("friend-new");
			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "friend-new",
					lineUserId: "line-user-1",
					displayName: "New Friend",
					lineAccountId: "account-1",
				}),
			);
		});

		it("friendRepo_upsert_existingFriend_shouldUpdate", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
			const selectChain = createSelectWhereChain([{ id: "friend-1" }]);
			const updateChain = createUpdateChain();
			const db = {
				select: vi.fn().mockReturnValueOnce(selectChain),
				update: vi.fn().mockReturnValueOnce(updateChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.upsert({
				lineUserId: "line-user-1" as LineUserId,
				displayName: "Updated Name",
				pictureUrl: "https://example.com/new.png",
				statusMessage: "updated",
			});

			expect(result).toBe("friend-1");
			expect(updateChain.set).toHaveBeenCalledWith(
				expect.objectContaining({
					displayName: "Updated Name",
					pictureUrl: "https://example.com/new.png",
					statusMessage: "updated",
					updatedAt: "2026-03-01T12:00:00.000Z",
				}),
			);
		});

		it("friendRepo_upsert_existingFriend_shouldSetIsFollowingTrue", async () => {
			const selectChain = createSelectWhereChain([{ id: "friend-1" }]);
			const updateChain = createUpdateChain();
			const db = {
				select: vi.fn().mockReturnValueOnce(selectChain),
				update: vi.fn().mockReturnValueOnce(updateChain),
			};
			const repository = createFriendRepository(db as never);

			await repository.upsert({
				lineUserId: "line-user-1" as LineUserId,
				displayName: "Updated Name",
				pictureUrl: null,
				statusMessage: null,
			});

			expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ isFollowing: true }));
		});
	});

	describe("assignTag / removeTag", () => {
		it("friendRepo_assignTag_shouldCreateJunction", async () => {
			const insertChain = createInsertConflictChain();
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			insertChain.values.mockReturnValueOnce({ onConflictDoNothing });
			const db = {
				insert: vi.fn().mockReturnValueOnce(insertChain),
			};
			const repository = createFriendRepository(db as never);

			await repository.assignTag("friend-1" as FriendId, "tag-1" as TagId);

			expect(insertChain.values).toHaveBeenCalledWith({ friendId: "friend-1", tagId: "tag-1" });
			expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
		});

		it("friendRepo_assignTag_duplicate_shouldBeIdempotent", async () => {
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			const insertChain = {
				values: vi.fn().mockReturnValue({ onConflictDoNothing }),
			};
			const db = {
				insert: vi.fn().mockReturnValueOnce(insertChain),
			};
			const repository = createFriendRepository(db as never);

			await expect(repository.assignTag("friend-1" as FriendId, "tag-1" as TagId)).resolves.toBeUndefined();

			expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
		});

		it("friendRepo_removeTag_shouldDeleteJunction", async () => {
			const deleteChain = createDeleteChain();
			const db = {
				delete: vi.fn().mockReturnValueOnce(deleteChain),
			};
			const repository = createFriendRepository(db as never);

			await repository.removeTag("friend-1" as FriendId, "tag-1" as TagId);

			expect(db.delete).toHaveBeenCalledWith(friendTags);
			expect(deleteChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: friendTags.friendId, right: "friend-1" }),
						expect.objectContaining({ kind: "eq", left: friendTags.tagId, right: "tag-1" }),
					]),
				}),
			);
		});
	});

	describe("updateScore", () => {
		it("friendRepo_updateScore_shouldAccumulate", async () => {
			const updateChain = createUpdateChain();
			const db = {
				update: vi.fn().mockReturnValueOnce(updateChain),
			};
			const repository = createFriendRepository(db as never);

			await repository.updateScore("friend-1" as FriendId, 7);

			expect(updateChain.set).toHaveBeenCalledWith(
				expect.objectContaining({
					score: expect.objectContaining({
						kind: "sql",
						values: expect.arrayContaining([7]),
					}),
				}),
			);
		});
	});

	describe("count", () => {
		it("friendRepo_count_shouldReturnTotal", async () => {
			const selectChain = createSelectWhereChain([{ count: 42 }]);
			const db = {
				select: vi.fn().mockReturnValueOnce(selectChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.count();

			expect(result).toBe(42);
		});

		it("friendRepo_count_withAccount_shouldFilterByAccount", async () => {
			const selectChain = createSelectWhereChain([{ count: 12 }]);
			const db = {
				select: vi.fn().mockReturnValueOnce(selectChain),
			};
			const repository = createFriendRepository(db as never);

			const result = await repository.count("account-9" as LineAccountId);

			expect(result).toBe(12);
			expect(selectChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: friends.lineAccountId, right: "account-9" }),
					]),
				}),
			);
		});
	});
});
