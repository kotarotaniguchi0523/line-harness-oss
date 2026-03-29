import { describe, expect, it } from "vitest";
import { BroadcastConfigSchema, BroadcastSchema, BroadcastStateSchema, CreateBroadcastSchema } from "./broadcast.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Broadcast Schema", () => {
	it("broadcastSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			title: "Spring campaign",
			messageType: "text",
			messageContent: "hello",
			targetType: "all",
			targetTagId: null,
			status: "scheduled",
			scheduledAt: ISO_DATE,
			sentAt: null,
			totalCount: 100,
			successCount: 0,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
			deletedAt: null,
		};

		// Act
		const result = BroadcastSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("broadcastConfigSchema_shouldParseConfigFieldsOnly", () => {
		// Arrange
		const input = {
			id: UUID,
			title: "Spring campaign",
			messageType: "text",
			messageContent: "hello",
			targetType: "all",
			targetTagId: null,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
		};

		// Act
		const result = BroadcastConfigSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("broadcastStateSchema_shouldParseStateFieldsOnly", () => {
		// Arrange
		const input = {
			status: "draft",
			scheduledAt: null,
			sentAt: null,
			totalCount: 0,
			successCount: 0,
		};

		// Act
		const result = BroadcastStateSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("broadcastSchema_shouldBeMergeOfConfigAndState", () => {
		// Arrange -- config fields + state fields combined
		const configInput = {
			id: UUID,
			title: "Merged test",
			messageType: "text",
			messageContent: "hello",
			targetType: "all",
			targetTagId: null,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
		};
		const stateInput = {
			status: "sent",
			scheduledAt: ISO_DATE,
			sentAt: ISO_DATE,
			totalCount: 50,
			successCount: 48,
		};

		// Act
		const result = BroadcastSchema.safeParse({ ...configInput, ...stateInput });

		// Assert
		expect(result.success).toBe(true);
	});

	it("createBroadcastSchema_tagTarget_requiresTagId", () => {
		// Arrange
		const input = {
			title: "VIP campaign",
			messageType: "text",
			messageContent: "exclusive",
			targetType: "tag",
		};

		// Act
		const result = CreateBroadcastSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(false);
	});

	it("createBroadcastSchema_allTarget_shouldParseWithoutTagId", () => {
		// Arrange
		const input = {
			title: "Everyone campaign",
			messageType: "text",
			messageContent: "hello all",
			targetType: "all",
			targetTagId: null,
			lineAccountId: UUID,
		};

		// Act
		const result = CreateBroadcastSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});
});
