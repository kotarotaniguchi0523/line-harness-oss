import { describe, expect, it } from "vitest";

import { friendId, hexColor, newId } from "./branded.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Branded types", () => {
	it("friendId_shouldBeBrandedString", () => {
		const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
		const brandedId = friendId(uuid);

		expect(brandedId).toBe(uuid);
		expect(typeof brandedId).toBe("string");
	});

	it("hexColor_valid_shouldReturnBranded", () => {
		const color = hexColor("#A1B2C3");

		expect(color).toBe("#A1B2C3");
	});

	it("hexColor_invalid_shouldThrow", () => {
		const createHexColor = () => hexColor("red");

		expect(createHexColor).toThrow("Invalid hex color: red");
	});

	it("newId_shouldReturnUUID", () => {
		const id = newId<"test-id">();

		expect(id).toMatch(UUID_V4_PATTERN);
	});
});
