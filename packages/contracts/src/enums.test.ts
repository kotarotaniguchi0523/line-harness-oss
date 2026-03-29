import { describe, expect, it } from "vitest";
import { AutomationEventType, BroadcastStatus, MessageType, StaffRole } from "./enums.js";

describe("Enums", () => {
	it("messageType_validValues_shouldParse", () => {
		// Arrange
		const validValues = ["text", "image", "flex", "carousel", "video"];

		// Act
		const results = validValues.map((value) => MessageType.safeParse(value));

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});

	it("messageType_invalidValue_shouldFail", () => {
		// Arrange
		const invalidValue = "unknown";

		// Act
		const result = MessageType.safeParse(invalidValue);

		// Assert
		expect(result.success).toBe(false);
	});

	it("broadcastStatus_validTransitions_shouldParse", () => {
		// Arrange
		const validValues = ["draft", "scheduled", "sending", "sent"];

		// Act
		const results = validValues.map((value) => BroadcastStatus.safeParse(value));

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});

	it("staffRole_validValues_shouldParse", () => {
		// Arrange
		const validValues = ["owner", "admin", "staff"];

		// Act
		const results = validValues.map((value) => StaffRole.safeParse(value));

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});

	it("automationEventType_allValues_shouldParse", () => {
		// Arrange
		const validValues = [
			"friend_add",
			"tag_change",
			"score_threshold",
			"cv_fire",
			"message_received",
			"calendar_booked",
		];

		// Act
		const results = validValues.map((value) => AutomationEventType.safeParse(value));

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});
});
