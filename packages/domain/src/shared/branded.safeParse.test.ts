import { describe, expect, it } from "vitest";
import { safeDisplayName, safeEmail, safeFriendId, safeHexColor, safeUrl } from "./branded";

describe("safeFriendId", () => {
	it("有効UUID_ok結果を返す", () => {
		// Arrange
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";

		// Act
		const result = safeFriendId(validUuid);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe(validUuid);
	});

	it("空文字_エラー結果を返す", () => {
		// Arrange
		const empty = "";

		// Act
		const result = safeFriendId(empty);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toContain("Invalid FriendId");
	});

	it("不正UUID_エラー結果を返す", () => {
		// Arrange
		const invalid = "not-a-uuid";

		// Act
		const result = safeFriendId(invalid);

		// Assert
		expect(result.isErr()).toBe(true);
		const errorMsg = result._unsafeUnwrapErr();
		expect(errorMsg).toContain("not a valid UUID");
		expect(errorMsg).toContain("not-a-uuid");
	});
});

describe("safeHexColor", () => {
	it("有効色_ok結果を返す", () => {
		// Arrange
		const color = "#FF00AA";

		// Act
		const result = safeHexColor(color);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe(color);
	});

	it("無効色_エラー結果を返す", () => {
		// Arrange
		const invalid = "red";

		// Act
		const result = safeHexColor(invalid);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toContain("Invalid hex color");
	});
});

describe("safeEmail", () => {
	it("有効メール_ok結果を返す", () => {
		// Arrange
		const validEmail = "user@example.com";

		// Act
		const result = safeEmail(validEmail);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe(validEmail);
	});

	it("不正メール_エラー結果を返す", () => {
		// Arrange
		const invalid = "not-an-email";

		// Act
		const result = safeEmail(invalid);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toContain("Invalid Email");
	});
});

describe("safeUrl", () => {
	it("有効URL_ok結果を返す", () => {
		// Arrange
		const validUrl = "https://example.com/path?q=1";

		// Act
		const result = safeUrl(validUrl);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe(validUrl);
	});

	it("不正URL_エラー結果を返す", () => {
		// Arrange
		const invalid = "not a url";

		// Act
		const result = safeUrl(invalid);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toContain("Invalid Url");
	});
});

describe("safeDisplayName", () => {
	it("201文字_エラー結果を返す", () => {
		// Arrange
		const tooLong = "a".repeat(201);

		// Act
		const result = safeDisplayName(tooLong);

		// Assert
		expect(result.isErr()).toBe(true);
		const errorMsg = result._unsafeUnwrapErr();
		expect(errorMsg).toContain("length must be 1-200");
		expect(errorMsg).toContain("201");
	});
});
