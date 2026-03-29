import { describe, expect, it } from "vitest";
import { NotificationSchema, ReminderStepSchema, ScoringRuleSchema, TemplateSchema } from "./engagement.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Engagement Schema", () => {
	it("scoringRuleSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Link click",
			eventType: "url_click",
			scoreValue: 5,
			isActive: true,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = ScoringRuleSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("templateSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Greeting",
			category: "general",
			messageType: "text",
			messageContent: "hello",
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = TemplateSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("notificationSchema_statusValues_shouldParse", () => {
		// Arrange
		const validValues = ["pending", "sent", "failed"];

		// Act
		const results = validValues.map((status) =>
			NotificationSchema.safeParse({
				id: UUID,
				ruleId: UUID,
				eventType: "friend_add",
				title: "Notice",
				body: "body",
				channel: "line",
				status,
				metadata: null,
				createdAt: ISO_DATE,
			}),
		);

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});

	it("reminderStepSchema_negativeOffset_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			reminderId: UUID,
			offsetMinutes: -1440,
			messageType: "text",
			messageContent: "1 day before",
			createdAt: ISO_DATE,
		};

		// Act
		const result = ReminderStepSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});
});
