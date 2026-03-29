import { describe, expect, it } from "vitest";
import {
	CreateScenarioSchema,
	ScenarioConfigSchema,
	ScenarioSchema,
	ScenarioStateSchema,
	ScenarioStepSchema,
	ScenarioWithStepsSchema,
} from "./scenario.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_DATE = "2026-03-27T10:30:00+09:00";

describe("Scenario Schema", () => {
	it("scenarioSchema_validObject_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Welcome",
			description: "first scenario",
			triggerType: "friend_add",
			triggerTagId: null,
			isActive: true,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
			deletedAt: null,
		};

		// Act
		const result = ScenarioSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("scenarioConfigSchema_shouldParseConfigFieldsOnly", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Welcome",
			description: "first scenario",
			triggerType: "friend_add",
			triggerTagId: null,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
		};

		// Act
		const result = ScenarioConfigSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("scenarioStateSchema_shouldParseStateFieldsOnly", () => {
		// Arrange
		const input = {
			isActive: true,
			updatedAt: ISO_DATE,
			deletedAt: null,
		};

		// Act
		const result = ScenarioStateSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("scenarioSchema_shouldBeMergeOfConfigAndState", () => {
		// Arrange
		const configInput = {
			id: UUID,
			name: "Merged test",
			description: null,
			triggerType: "manual",
			triggerTagId: null,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
		};
		const stateInput = {
			isActive: false,
			updatedAt: ISO_DATE,
		};

		// Act
		const result = ScenarioSchema.safeParse({ ...configInput, ...stateInput });

		// Assert
		expect(result.success).toBe(true);
	});

	it("createScenarioSchema_withTriggerType_shouldParse", () => {
		// Arrange
		const input = {
			name: "VIP onboarding",
			description: "tag flow",
			triggerType: "tag_added",
			triggerTagId: UUID,
			lineAccountId: UUID,
		};

		// Act
		const result = CreateScenarioSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("scenarioStepSchema_withCondition_shouldParse", () => {
		// Arrange
		const input = {
			id: UUID,
			scenarioId: UUID,
			stepOrder: 1,
			delayMinutes: 60,
			messageType: "text",
			messageContent: "hello",
			conditionType: "tag_exists",
			conditionValue: UUID,
			nextStepOnFalse: 2,
			createdAt: ISO_DATE,
		};

		// Act
		const result = ScenarioStepSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});

	it("scenarioWithStepsSchema_shouldNest", () => {
		// Arrange
		const input = {
			id: UUID,
			name: "Welcome",
			description: "first scenario",
			triggerType: "manual",
			triggerTagId: null,
			isActive: true,
			lineAccountId: UUID,
			createdAt: ISO_DATE,
			updatedAt: ISO_DATE,
			steps: [
				{
					id: UUID,
					scenarioId: UUID,
					stepOrder: 0,
					delayMinutes: 0,
					messageType: "text",
					messageContent: "hello",
					createdAt: ISO_DATE,
				},
			],
		};

		// Act
		const result = ScenarioWithStepsSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
	});
});
