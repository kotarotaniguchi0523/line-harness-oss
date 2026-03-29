import { describe, expect, it } from "vitest";
import { HexColorSchema, IsoDateSchema, PaginationInputSchema, UuidSchema } from "./common.js";

describe("Common Schemas", () => {
	it("uuidSchema_valid_shouldParse", () => {
		// Arrange
		const input = "550e8400-e29b-41d4-a716-446655440000";

		// Act
		const result = UuidSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("uuidSchema_invalid_shouldFail", () => {
		// Arrange
		const input = "not-a-uuid";

		// Act
		const result = UuidSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});

	it("isoDateSchema_valid_shouldParse", () => {
		// Arrange
		const input = "2026-03-27T10:30:00+09:00";

		// Act
		const result = IsoDateSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("hexColorSchema_valid_shouldParse", () => {
		// Arrange
		const input = "#A1B2C3";

		// Act
		const result = HexColorSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("hexColorSchema_invalid_shouldFail", () => {
		// Arrange
		const input = "#GGG";

		// Act
		const result = HexColorSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});

	it("paginationInputSchema_defaults_shouldApply", () => {
		// Arrange
		const input = {};

		// Act
		const result = PaginationInputSchema.parse(input);

		// Assert
		expect(result).toEqual({ page: 1, limit: 20 });
	});

	it("paginationInputSchema_maxLimit_shouldClamp", () => {
		// Arrange
		const input = { limit: 101 };

		// Act
		const result = PaginationInputSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});
});
