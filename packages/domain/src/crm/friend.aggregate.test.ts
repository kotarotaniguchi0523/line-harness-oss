import { describe, expect, it } from "vitest";
import {
	type FriendId,
	friendId,
	type LineAccountId,
	type LineUserId,
	lineAccountId,
	lineUserId,
	type TagId,
	tagId,
} from "../shared/branded.js";
import { ErrorCodes, ErrorMessages } from "../shared/result.js";
import { FriendAggregate } from "./friend.aggregate.js";

const TEST_FRIEND = "11111111-1111-1111-1111-111111111111";
const TEST_ACCOUNT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEST_TAG_1 = "22222222-2222-2222-2222-222222222222";
const TEST_TAG_MISSING = "99999999-9999-9999-9999-999999999999";

function createFriendAggregate(overrides?: {
	friendId?: FriendId;
	lineUserId?: LineUserId;
	displayName?: string | null;
	lineAccountId?: LineAccountId | null;
}) {
	const aggregateId = overrides?.friendId ?? friendId(TEST_FRIEND);
	const aggregateLineUserId = overrides?.lineUserId ?? lineUserId("line-user-1");
	const aggregateDisplayName = overrides?.displayName ?? "Alice";
	const aggregateLineAccountId = overrides?.lineAccountId ?? lineAccountId(TEST_ACCOUNT);

	return FriendAggregate.create(aggregateId, aggregateLineUserId, aggregateDisplayName, aggregateLineAccountId);
}

describe("FriendAggregate", () => {
	it("friendAggregate_create_shouldInitializeWithCorrectProps", () => {
		const aggregateId = friendId(TEST_FRIEND);
		const aggregateLineUserId = lineUserId("line-user-1");
		const aggregateDisplayName = "Alice";
		const aggregateLineAccountId = lineAccountId(TEST_ACCOUNT);

		const aggregate = FriendAggregate.create(
			aggregateId,
			aggregateLineUserId,
			aggregateDisplayName,
			aggregateLineAccountId,
		);

		expect(aggregate.id).toBe(aggregateId);
		expect(aggregate.lineUserId).toBe(aggregateLineUserId);
		expect(aggregate.displayName).toBe(aggregateDisplayName);
		expect(aggregate.lineAccountId).toBe(aggregateLineAccountId);
	});

	it("friendAggregate_create_shouldEmitFriendAddedEvent", () => {
		const aggregate = createFriendAggregate();

		const events = aggregate.pullEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "friend_added",
			friendId: aggregate.id,
			displayName: "Alice",
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});
	});

	it("friendAggregate_create_isFollowingShouldBeTrue", () => {
		const aggregate = createFriendAggregate();

		const isFollowing = aggregate.isFollowing;

		expect(isFollowing).toBe(true);
	});

	it("friendAggregate_create_scoreShouldBeZero", () => {
		const aggregate = createFriendAggregate();

		const score = aggregate.score;

		expect(score).toBe(0);
	});

	it("friendAggregate_reconstitute_shouldNotEmitEvents", () => {
		const aggregate = FriendAggregate.reconstitute(friendId(TEST_FRIEND), {
			lineUserId: lineUserId("line-user-1"),
			displayName: "Alice",
			pictureUrl: null,
			statusMessage: null,
			isFollowing: true,
			score: 3,
			metadata: null,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
			tagIds: new Set<TagId>([tagId(TEST_TAG_1)]),
		});

		const events = aggregate.pullEvents();

		expect(events).toEqual([]);
	});

	it("friendAggregate_unfollow_shouldSetIsFollowingToFalse", () => {
		const aggregate = createFriendAggregate();
		aggregate.pullEvents();

		aggregate.unfollow();

		expect(aggregate.isFollowing).toBe(false);
	});

	it("friendAggregate_unfollow_shouldEmitFriendUnfollowedEvent", () => {
		const aggregate = createFriendAggregate();
		aggregate.pullEvents();

		aggregate.unfollow();
		const events = aggregate.pullEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "friend_unfollowed",
			friendId: aggregate.id,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});
	});

	it("friendAggregate_refollow_shouldSetIsFollowingToTrue", () => {
		const aggregate = createFriendAggregate();
		aggregate.pullEvents();
		aggregate.unfollow();

		aggregate.refollow("Alice Reloaded", "https://example.com/alice.png");

		expect(aggregate.isFollowing).toBe(true);
	});

	it("friendAggregate_assignTag_shouldAddTagToSet", () => {
		const aggregate = createFriendAggregate();
		aggregate.pullEvents();
		const assignedTagId = tagId(TEST_TAG_1);

		aggregate.assignTag(assignedTagId);

		expect(aggregate.tagIds.has(assignedTagId)).toBe(true);
	});

	it("friendAggregate_assignTag_shouldEmitTagAssignedEvent", () => {
		const aggregate = createFriendAggregate();
		aggregate.pullEvents();
		const assignedTagId = tagId(TEST_TAG_1);

		aggregate.assignTag(assignedTagId);
		const events = aggregate.pullEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "tag_assigned",
			friendId: aggregate.id,
			tagId: assignedTagId,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});
	});

	it("friendAggregate_assignTag_shouldBeIdempotent", () => {
		const aggregate = createFriendAggregate();
		aggregate.pullEvents();
		const assignedTagId = tagId(TEST_TAG_1);

		const firstResult = aggregate.assignTag(assignedTagId);
		const secondResult = aggregate.assignTag(assignedTagId);
		const events = aggregate.pullEvents();

		expect(firstResult.isOk()).toBe(true);
		expect(secondResult.isOk()).toBe(true);
		expect(aggregate.tagIds.size).toBe(1);
		expect(events).toHaveLength(1);
	});

	it("friendAggregate_removeTag_shouldRemoveTagFromSet", () => {
		const aggregate = createFriendAggregate();
		const assignedTagId = tagId(TEST_TAG_1);
		aggregate.assignTag(assignedTagId);
		aggregate.pullEvents();

		aggregate.removeTag(assignedTagId);

		expect(aggregate.tagIds.has(assignedTagId)).toBe(false);
	});

	it("friendAggregate_removeTag_shouldEmitTagRemovedEvent", () => {
		const aggregate = createFriendAggregate();
		const assignedTagId = tagId(TEST_TAG_1);
		aggregate.assignTag(assignedTagId);
		aggregate.pullEvents();

		aggregate.removeTag(assignedTagId);
		const events = aggregate.pullEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "tag_removed",
			friendId: aggregate.id,
			tagId: assignedTagId,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});
	});

	it("friendAggregate_removeTag_nonExistentTag_shouldReturnDomainError", () => {
		const aggregate = createFriendAggregate();

		const result = aggregate.removeTag(tagId(TEST_TAG_MISSING));

		expect(result.isErr()).toBe(true);
		const error = result._unsafeUnwrapErr();
		expect(error.code).toBe(ErrorCodes.NOT_ASSIGNED);
		expect(error.message).toBe(ErrorMessages.TAG_NOT_ASSIGNED);
		expect(error.context).toEqual({ tagId: TEST_TAG_MISSING });
	});

	it("friendAggregate_addScore_shouldAccumulatePositive", () => {
		const aggregate = createFriendAggregate();

		aggregate.addScore(10);

		expect(aggregate.score).toBe(10);
	});

	it("friendAggregate_addScore_shouldAccumulateNegative", () => {
		const aggregate = createFriendAggregate();
		aggregate.addScore(10);

		aggregate.addScore(-4);

		expect(aggregate.score).toBe(6);
	});

	it("friendAggregate_pullEvents_shouldReturnAndClearEvents", () => {
		const aggregate = createFriendAggregate();

		const firstEvents = aggregate.pullEvents();
		const secondEvents = aggregate.pullEvents();

		expect(firstEvents).toHaveLength(1);
		expect(secondEvents).toEqual([]);
	});
});
