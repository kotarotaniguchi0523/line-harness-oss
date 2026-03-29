import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScenariosRpc } from "./scenarios.rpc.js";

const { createScenarioQueriesMock, createScenarioCommandsMock } = vi.hoisted(() => ({
	createScenarioQueriesMock: vi.fn(),
	createScenarioCommandsMock: vi.fn(),
}));

vi.mock("../services/scenario.service.js", () => ({
	createScenarioService: (db: unknown) => ({
		queries: createScenarioQueriesMock(db),
		commands: createScenarioCommandsMock(db),
	}),
}));

describe("ScenariosRpc", () => {
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

	const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
	const uuid2 = "660e8400-e29b-41d4-a716-446655440001";
	const uuid3 = "770e8400-e29b-41d4-a716-446655440002";

	const staffContext = { id: "staff-1", name: "Alice", role: "staff" };
	const adminContext = { id: "admin-1", name: "Bob", role: "admin" };

	beforeEach(() => {
		for (const fn of Object.values(queries)) fn.mockReset();
		for (const fn of Object.values(commands)) fn.mockReset();
		createScenarioQueriesMock.mockReset();
		createScenarioCommandsMock.mockReset();
		createScenarioQueriesMock.mockReturnValue(queries);
		createScenarioCommandsMock.mockReturnValue(commands);
	});

	it("scenariosRpc_list_shouldDelegateToQueries", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staffContext);
		queries.listScenarios.mockResolvedValue(ok([{ id: uuid1 }]));

		// Act
		const result = await rpc.list(uuid2);

		// Assert
		expect(queries.listScenarios).toHaveBeenCalledWith(staffContext, uuid2);
		expect(result).toEqual([{ id: uuid1 }]);
	});

	it("scenariosRpc_list_serviceError_shouldThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staffContext);
		queries.listScenarios.mockResolvedValue(
			err({ code: "FORBIDDEN", message: "Insufficient permissions to read scenario data" }),
		);

		// Act & Assert
		await expect(rpc.list(uuid2)).rejects.toThrow("[FORBIDDEN]");
	});

	it("scenariosRpc_create_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, adminContext);
		commands.createScenario.mockResolvedValue(ok(uuid1));
		const input = {
			name: "Welcome",
			description: "desc",
			triggerType: "friend_add" as const,
			triggerTagId: uuid2,
			lineAccountId: uuid3,
		};

		// Act
		const result = await rpc.create(input);

		// Assert
		expect(commands.createScenario).toHaveBeenCalledWith(adminContext, {
			name: "Welcome",
			description: "desc",
			triggerType: "friend_add",
			triggerTagId: uuid2,
			lineAccountId: uuid3,
		});
		expect(result).toBe(uuid1);
	});

	it("scenariosRpc_create_forbidden_shouldThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staffContext);
		commands.createScenario.mockResolvedValue(
			err({ code: "FORBIDDEN", message: "Only owner or admin can modify scenarios" }),
		);

		// Act & Assert
		await expect(rpc.create({ name: "Test", triggerType: "friend_add" })).rejects.toThrow("[FORBIDDEN]");
	});

	it("scenariosRpc_delete_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, adminContext);
		commands.deleteScenario.mockResolvedValue(ok(undefined));

		// Act
		await rpc.delete(uuid1);

		// Assert
		expect(commands.deleteScenario).toHaveBeenCalledWith(adminContext, uuid1);
	});

	it("scenariosRpc_get_notFound_shouldThrow", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staffContext);
		queries.getScenario.mockResolvedValue(err({ code: "NOT_FOUND", message: "Scenario not found" }));

		// Act & Assert
		await expect(rpc.get(uuid1)).rejects.toThrow("[NOT_FOUND]");
	});

	it("scenariosRpc_addStep_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, adminContext);
		commands.addStep.mockResolvedValue(ok(uuid2));
		const stepData = {
			stepOrder: 1,
			delayMinutes: 60,
			messageType: "text",
			messageContent: "Hello",
		};

		// Act
		const result = await rpc.addStep(uuid1, stepData);

		// Assert
		expect(commands.addStep).toHaveBeenCalledWith(adminContext, uuid1, stepData);
		expect(result).toBe(uuid2);
	});

	it("scenariosRpc_removeStep_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, adminContext);
		commands.removeStep.mockResolvedValue(ok(undefined));

		// Act
		await rpc.removeStep(uuid1);

		// Assert
		expect(commands.removeStep).toHaveBeenCalledWith(adminContext, uuid1);
	});

	it("scenariosRpc_setActive_shouldDelegateToCommands", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, adminContext);
		commands.setActive.mockResolvedValue(ok(undefined));

		// Act
		await rpc.setActive(uuid1, false);

		// Assert
		expect(commands.setActive).toHaveBeenCalledWith(adminContext, uuid1, false);
	});

	it("scenariosRpc_listActive_shouldDelegateToQueries", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staffContext);
		queries.listActive.mockResolvedValue(ok([{ id: uuid1 }]));

		// Act
		const result = await rpc.listActive(uuid2);

		// Assert
		expect(queries.listActive).toHaveBeenCalledWith(staffContext, uuid2);
		expect(result).toEqual([{ id: uuid1 }]);
	});

	it("scenariosRpc_get_invalidUuid_shouldThrowValidationError", async () => {
		// Arrange
		const rpc = new ScenariosRpc({} as never, staffContext);

		// Act & Assert
		await expect(rpc.get("not-a-uuid")).rejects.toThrow("Validation failed");
	});
});
