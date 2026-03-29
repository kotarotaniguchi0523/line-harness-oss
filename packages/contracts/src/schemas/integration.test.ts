import { describe, expect, it } from "vitest";
import { AdPlatformSchema, CalendarBookingSchema, OutgoingWebhookSchema } from "./integration.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Integration Schema", () => {
	it("outgoingWebhookSchema_urlValidation_shouldRequireUrl", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Webhook",
			url: "not-a-url",
			eventTypes: ["friend.created"],
			secret: null,
			isActive: true,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = OutgoingWebhookSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});

	it("calendarBookingSchema_statusValues_shouldParse", () => {
		// Arrange
		const validValues = ["confirmed", "cancelled", "completed"];

		// Act
		const results = validValues.map((status) =>
			CalendarBookingSchema.safeParse({
				id: UUID,
				connectionId: UUID,
				friendId: UUID,
				eventId: "evt_123",
				title: "Meeting",
				startAt: ISO_DATE,
				endAt: ISO_DATE,
				status,
				metadata: null,
				createdAt: ISO_DATE,
				updatedAt: ISO_DATE,
			}),
		);

		// Assert
		expect(results.every((result) => result.success)).toBe(true);
	});

	it("adPlatformSchema_configAsRecord_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "meta",
			displayName: "Meta Ads",
			config: { pixelId: "12345", enabled: true },
			isActive: true,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = AdPlatformSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});
});
