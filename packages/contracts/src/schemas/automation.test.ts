import { describe, expect, it } from "vitest";
import { AutomationActionSchema, AutomationConditionsSchema, AutomationSchema } from "./automation.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Automation Schema", () => {
	it("automationSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Score to VIP",
			description: "add VIP tag",
			eventType: "score_threshold",
			conditions: { scoreThreshold: 100 },
			actions: [{ type: "add_tag", params: { tagId: UUID } }],
			isActive: true,
			priority: 1,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = AutomationSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("automationActionSchema_validTypes_shouldParse", () => {
		// Arrange
		const validTypes = [
			"add_tag",
			"remove_tag",
			"start_scenario",
			"send_message",
			"send_webhook",
			"switch_rich_menu",
			"remove_rich_menu",
			"set_metadata",
		];

		// Act
		const results = validTypes.map((type) => AutomationActionSchema.safeParse({ type, params: { any: "value" } }));

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});

	it("automationConditionsSchema_passthrough_shouldAllowExtra", () => {
		// Arrange
		const input = {
			scoreThreshold: 100,
			customField: "allowed",
		};

		// Act
		const result = AutomationConditionsSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
		expect(result.success && result.data.customField).toBe("allowed");
	});
});
