import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScenariosRpc } from "../scenarios.rpc.js";

const { createScenarioQueriesMock, createScenarioCommandsMock } = vi.hoisted(() => ({
	createScenarioQueriesMock: vi.fn(),
	createScenarioCommandsMock: vi.fn(),
}));

vi.mock("../../services/scenario.service.js", () => ({
	createScenarioService: (db: unknown) => ({
		queries: createScenarioQueriesMock(db),
		commands: createScenarioCommandsMock(db),
	}),
}));

describe("ScenariosRpc safeParse validation", () => {
	const queries = {
		listScenarios: vi.fn(),
		getScenario: vi.fn(),
		listActive: vi.fn(),
	};

	const commands = {
		createScenario: vi.fn(),
		addStep: vi.fn(),
		removeStep: vi.fn(),
		setActive: vi.fn(),
		deleteScenario: vi.fn(),
		enrollFriend: vi.fn(),
	};

	const staff = { id: "staff-1", name: "Alice", role: "staff" as const };
	const validUuid = "550e8400-e29b-41d4-a716-446655440000";

	beforeEach(() => {
		for (const fn of Object.values(queries)) fn.mockReset();
		for (const fn of Object.values(commands)) fn.mockReset();
		createScenarioQueriesMock.mockReset();
		createScenarioCommandsMock.mockReset();
		createScenarioQueriesMock.mockReturnValue(queries);
		createScenarioCommandsMock.mockReturnValue(commands);
	});

	// -------------------------------------------------------------------------
	// 7. create with empty name should throw validation error
	// -------------------------------------------------------------------------
	it("create_emptyName_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);
		commands.createScenario.mockResolvedValue(
			err({
				code: "VALIDATION_FAILED",
				message: "Scenario creation input failed validation",
				details: { issues: [{ path: ["name"], message: "String must contain at least 1 character(s)" }] },
			}),
		);

		// Act
		const act = rpc.create({
			name: "",
			triggerType: "friend_add",
		});

		// Assert
		await expect(act).rejects.toThrow("VALIDATION_FAILED");
	});

	// -------------------------------------------------------------------------
	// 8. addStep with invalid scenarioId should throw validation error
	// -------------------------------------------------------------------------
	it("addStep_invalidScenarioId_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);

		// Act
		const act = rpc.addStep("not-a-uuid", {
			stepOrder: 0,
			delayMinutes: 10,
			messageType: "text",
			messageContent: "Hello",
		});

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// 9. addStep with negative delayMinutes should propagate service error
	// -------------------------------------------------------------------------
	it("addStep_negativeDelayMinutes_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);
		commands.addStep.mockResolvedValue(
			err({
				code: "VALIDATION_FAILED",
				message: "Scenario step input failed validation",
				details: { issues: [{ path: ["delayMinutes"], message: "Number must be greater than or equal to 0" }] },
			}),
		);

		// Act
		const act = rpc.addStep(validUuid, {
			stepOrder: 0,
			delayMinutes: -5,
			messageType: "text",
			messageContent: "Hello",
		});

		// Assert
		await expect(act).rejects.toThrow("VALIDATION_FAILED");
	});

	// -------------------------------------------------------------------------
	// 10. removeStep with invalid stepId should throw validation error
	// -------------------------------------------------------------------------
	it("removeStep_invalidStepId_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);

		// Act
		const act = rpc.removeStep("invalid-step-id");

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// 11. setActive with invalid isActive type should throw validation error
	// -------------------------------------------------------------------------
	it("setActive_invalidIsActiveType_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);

		// Act
		const act = rpc.setActive(validUuid, "yes" as unknown as boolean);

		// Assert
		await expect(act).rejects.toThrow("Validation failed");
	});

	// -------------------------------------------------------------------------
	// Happy path tests
	// -------------------------------------------------------------------------
	it("create_validInput_shouldNotThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);
		commands.createScenario.mockResolvedValue(ok("scenario-1"));

		// Act & Assert
		await expect(rpc.create({ name: "Welcome", triggerType: "friend_add" })).resolves.not.toThrow();
	});

	it("addStep_validInput_shouldNotThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);
		commands.addStep.mockResolvedValue(ok("step-1"));

		// Act & Assert
		await expect(
			rpc.addStep(validUuid, {
				stepOrder: 0,
				delayMinutes: 10,
				messageType: "text",
				messageContent: "Hello",
			}),
		).resolves.not.toThrow();
	});

	it("removeStep_validUuid_shouldNotThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);
		commands.removeStep.mockResolvedValue(ok(undefined));

		// Act & Assert
		await expect(rpc.removeStep(validUuid)).resolves.not.toThrow();
	});

	it("setActive_validInput_shouldNotThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staff);
		commands.setActive.mockResolvedValue(ok(undefined));

		// Act & Assert
		await expect(rpc.setActive(validUuid, true)).resolves.not.toThrow();
	});
});
