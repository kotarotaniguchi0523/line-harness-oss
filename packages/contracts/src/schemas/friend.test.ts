import { describe, expect, it } from "vitest";
import {
	CreateFriendSchema,
	FriendIdentitySchema,
	FriendSchema,
	FriendStateSchema,
	FriendWithTagsSchema,
} from "./friend.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Friend Schema", () => {
	it("friendSchema_fullObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			lineUserId: "U1234567890",
			displayName: "Taro",
			pictureUrl: "https://example.com/avatar.png",
			statusMessage: "hello",
			isFollowing: true,
			userId: UUID,
			score: 10,
			metadata: { segment: "vip" },
			lineAccountId: UUID,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
			deletedAt: null,
		};

		// Act
		const result = FriendSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("friendIdentitySchema_shouldParseIdentityFieldsOnly", () => {
		// Arrange
		const input = {
			id: UUID,
			lineUserId: "U1234567890",
			lineAccountId: UUID,
			createdAt: ISO_DATE,
		};

		// Act
		const result = FriendIdentitySchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("friendStateSchema_shouldParseStateFieldsOnly", () => {
		// Arrange
		const input = {
			displayName: "Taro",
			pictureUrl: "https://example.com/avatar.png",
			statusMessage: "hello",
			isFollowing: true,
			userId: UUID,
			score: 10,
			metadata: { segment: "vip" },
			updatedAt: ISO_DATE,
			deletedAt: null,
		};

		// Act
		const result = FriendStateSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("friendSchema_shouldBeMergeOfIdentityAndState", () => {
		// Arrange
		const identityInput = {
			id: UUID,
			lineUserId: "U1234567890",
			lineAccountId: UUID,
			createdAt: ISO_DATE,
		};
		const stateInput = {
			displayName: "Taro",
			pictureUrl: "https://example.com/avatar.png",
			statusMessage: "hello",
			isFollowing: true,
			userId: UUID,
			score: 10,
			metadata: null,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = FriendSchema.safeParse({ ...identityInput, ...stateInput });

		// Assert
		expect(result.success).toBe(true);
	});

	it("friendSchema_nullableFields_shouldAcceptNull", () => {
		// Arrange
		const input = {
			id: UUID,
			lineUserId: "U1234567890",
			displayName: null,
			pictureUrl: null,
			statusMessage: null,
			isFollowing: true,
			userId: null,
			metadata: null,
			lineAccountId: null,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = FriendSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("friendSchema_missingRequired_shouldFail", () => {
		// Arrange
		const input = {
			id: UUID,
			displayName: "Taro",
		};

		// Act
		const result = FriendSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});

	it("createFriendSchema_minimalInput_shouldParse", () => {
		// Arrange
		const input = {
			lineUserId: "U1234567890",
			displayName: null,
			pictureUrl: null,
			statusMessage: null,
		};

		// Act
		const result = CreateFriendSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("friendWithTagsSchema_shouldIncludeTags", () => {
		// Arrange
		const input = {
			id: UUID,
			lineUserId: "U1234567890",
			displayName: "Taro",
			pictureUrl: "https://example.com/avatar.png",
			statusMessage: "hello",
			isFollowing: true,
			userId: UUID,
			score: 10,
			metadata: { segment: "vip" },
			lineAccountId: UUID,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
			tags: [
				{
					id: UUID,
					name: "VIP",
					color: "#112233",
					createdAt: ISO_DATE,
				},
			],
		};

		// Act
		const result = FriendWithTagsSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});
});
