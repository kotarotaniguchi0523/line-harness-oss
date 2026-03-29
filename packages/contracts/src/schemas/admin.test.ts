import { describe, expect, it } from "vitest";
import { AccountHealthLogSchema, CreateStaffMemberSchema, LineAccountSchema, StaffMemberSchema } from "./admin.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Admin Schema", () => {
	it("staffMemberSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Admin User",
			email: "admin@example.com",
			role: "admin",
			apiKey: "secret-key",
			isActive: true,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = StaffMemberSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("createStaffMemberSchema_ownerRole_shouldFail", () => {
		// Arrange
		const input = {
			name: "Owner User",
			email: "owner@example.com",
			role: "owner",
		};

		// Act
		const result = CreateStaffMemberSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});

	it("lineAccountSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			channelId: "1234567890",
			name: "Main Account",
			channelAccessToken: "token",
			channelSecret: "secret",
			isActive: true,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = LineAccountSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("accountHealthLogSchema_riskLevels_shouldParse", () => {
		// Arrange
		const validValues = ["normal", "warning", "danger"];

		// Act
		const results = validValues.map((riskLevel) =>
			AccountHealthLogSchema.safeParse({
				id: UUID,
				lineAccountId: UUID,
				errorCode: null,
				errorCount: 0,
				checkPeriod: "2026-03",
				riskLevel,
				createdAt: ISO_DATE,
			}),
		);

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});
});
