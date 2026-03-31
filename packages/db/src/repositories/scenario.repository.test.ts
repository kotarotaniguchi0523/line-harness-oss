import type { LineAccountId, ScenarioId, ScenarioStepId, TagId } from "@line-crm/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { friendScenarios, scenarioSteps, scenarios } from "../schema/index.js";
import { createScenarioRepository } from "./scenario.repository.js";

vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof import("drizzle-orm")>();
	const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		kind: "sql",
		strings: Array.from(strings),
		values,
	}));

	return {
		...actual,
		eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
		and: vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions })),
		isNull: vi.fn((value: unknown) => ({ kind: "isNull", value })),
		desc: vi.fn((value: unknown) => ({ kind: "desc", value })),
		sql: Object.assign(sqlMock, {
			join: vi.fn((items: unknown[], separator: unknown) => ({ kind: "join", items, separator })),
		}),
	};
});

function createSelectWhereChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(result),
	};
}

function createSelectWhereLimitChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(result),
	};
}

function createSelectWhereOrderChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue(result),
	};
}

function createInsertValuesChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

function createUpdateChain() {
	return {
		set: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(undefined),
	};
}

function createDeleteChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

function buildScenario(id: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		name: `${id}-scenario`,
		description: `${id}-description`,
		triggerType: "friend_add",
		triggerTagId: null,
		isActive: 1,
		lineAccountId: "account-1",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		deletedAt: null,
		...overrides,
	};
}

function buildStep(id: string, scenarioId: string, stepOrder: number) {
	return {
		id,
		scenarioId,
		stepOrder,
		delayMinutes: stepOrder * 10,
		messageType: "text",
		messageContent: `step-${stepOrder}`,
		conditionType: null,
		conditionValue: null,
		nextStepOnFalse: null,
		createdAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("ScenarioRepository", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe("list", () => {
		it("scenarioRepo_list_shouldReturnWithSteps", async () => {
			const scenarioRows = [buildScenario("scenario-1"), buildScenario("scenario-2", { isActive: 0 })];
			const stepRows = [
				buildStep("step-1", "scenario-1", 1),
				buildStep("step-2", "scenario-1", 2),
				buildStep("step-3", "scenario-2", 1),
			];
			const scenariosChain = createSelectWhereOrderChain(scenarioRows);
			const stepsChain = createSelectWhereOrderChain(stepRows);
			const db = {
				select: vi.fn().mockReturnValueOnce(scenariosChain).mockReturnValueOnce(stepsChain),
			};
			const repository = createScenarioRepository(db as never);

			const result = await repository.list();

			expect(result).toEqual([
				{ ...scenarioRows[0], isActive: true, steps: [stepRows[0], stepRows[1]] },
				{ ...scenarioRows[1], isActive: false, steps: [stepRows[2]] },
			]);
			expect(db.select).toHaveBeenCalledTimes(2);
		});

		it("scenarioRepo_list_softDeleted_shouldBeExcluded", async () => {
			const scenariosChain = createSelectWhereOrderChain([]);
			const db = {
				select: vi.fn().mockReturnValueOnce(scenariosChain),
			};
			const repository = createScenarioRepository(db as never);

			const result = await repository.list();

			expect(result).toEqual([]);
			expect(scenariosChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([expect.objectContaining({ kind: "isNull", value: scenarios.deletedAt })]),
				}),
			);
		});
	});

	describe("findById", () => {
		it("scenarioRepo_findById_shouldReturnWithSteps", async () => {
			const scenarioChain = createSelectWhereChain([buildScenario("scenario-1")]);
			const stepsChain = createSelectWhereOrderChain([buildStep("step-1", "scenario-1", 1)]);
			const db = {
				select: vi.fn().mockReturnValueOnce(scenarioChain).mockReturnValueOnce(stepsChain),
			};
			const repository = createScenarioRepository(db as never);

			const result = await repository.findById("scenario-1" as ScenarioId);

			expect(result).toEqual({
				...buildScenario("scenario-1"),
				isActive: true,
				steps: [buildStep("step-1", "scenario-1", 1)],
			});
		});

		it("scenarioRepo_findById_notFound_shouldReturnNull", async () => {
			const scenarioChain = createSelectWhereChain([]);
			const db = {
				select: vi.fn().mockReturnValueOnce(scenarioChain),
			};
			const repository = createScenarioRepository(db as never);

			const result = await repository.findById("missing" as ScenarioId);

			expect(result).toBeNull();
		});
	});

	describe("create / addStep / removeStep", () => {
		it("scenarioRepo_create_shouldInsertScenario", async () => {
			const insertChain = createInsertValuesChain();
			const db = {
				insert: vi.fn().mockReturnValueOnce(insertChain),
			};
			const repository = createScenarioRepository(db as never);
			const randomUUID = vi.fn().mockReturnValue("scenario-new");
			vi.stubGlobal("crypto", { randomUUID });

			const result = await repository.create({
				name: "Welcome",
				description: "Scenario description",
				triggerType: "friend_add",
				triggerTagId: "tag-1" as TagId,
				lineAccountId: "account-1" as LineAccountId,
			});

			expect(result).toBe("scenario-new");
			expect(db.insert).toHaveBeenCalledWith(scenarios);
			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "scenario-new",
					name: "Welcome",
					triggerTagId: "tag-1",
					lineAccountId: "account-1",
				}),
			);
		});

		it("scenarioRepo_addStep_shouldInsertStep", async () => {
			const insertChain = createInsertValuesChain();
			const db = {
				insert: vi.fn().mockReturnValueOnce(insertChain),
			};
			const repository = createScenarioRepository(db as never);
			const randomUUID = vi.fn().mockReturnValue("step-new");
			vi.stubGlobal("crypto", { randomUUID });

			const result = await repository.addStep("scenario-1" as ScenarioId, {
				stepOrder: 2,
				delayMinutes: 30,
				messageType: "text",
				messageContent: "hello",
				conditionType: "tag",
				conditionValue: "vip",
				nextStepOnFalse: 4,
			});

			expect(result).toBe("step-new");
			expect(db.insert).toHaveBeenCalledWith(scenarioSteps);
			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "step-new",
					scenarioId: "scenario-1",
					stepOrder: 2,
					nextStepOnFalse: 4,
				}),
			);
		});

		it("scenarioRepo_removeStep_shouldDeleteStep", async () => {
			const deleteChain = createDeleteChain();
			const db = {
				delete: vi.fn().mockReturnValueOnce(deleteChain),
			};
			const repository = createScenarioRepository(db as never);

			await repository.removeStep("step-1" as ScenarioStepId);

			expect(db.delete).toHaveBeenCalledWith(scenarioSteps);
			expect(deleteChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "eq",
					left: scenarioSteps.id,
					right: "step-1",
				}),
			);
		});
	});

	describe("setActive / delete", () => {
		it("scenarioRepo_setActive_shouldUpdateIsActive", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
			const updateChain = createUpdateChain();
			const db = {
				update: vi.fn().mockReturnValueOnce(updateChain),
			};
			const repository = createScenarioRepository(db as never);

			await repository.setActive("scenario-1" as ScenarioId, false);

			expect(db.update).toHaveBeenCalledWith(scenarios);
			expect(updateChain.set).toHaveBeenCalledWith({
				isActive: false,
				updatedAt: "2026-03-01T12:00:00.000Z",
			});
		});

		it("scenarioRepo_delete_shouldSoftDelete", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-03-02T09:30:00.000Z"));
			const updateChain = createUpdateChain();
			const db = {
				update: vi.fn().mockReturnValueOnce(updateChain),
			};
			const repository = createScenarioRepository(db as never);

			await repository.delete("scenario-1" as ScenarioId);

			expect(updateChain.set).toHaveBeenCalledWith({
				deletedAt: "2026-03-02T09:30:00.000Z",
			});
		});
	});

	describe("updateStep", () => {
		it("scenarioRepo_updateStep_validFields_shouldCallDrizzleUpdate", async () => {
			const updateChain = createUpdateChain();
			const db = {
				update: vi.fn().mockReturnValueOnce(updateChain),
			};
			const repository = createScenarioRepository(db as never);

			await repository.updateStep("step-1" as ScenarioStepId, {
				stepOrder: 2,
				messageType: "text",
			});

			expect(db.update).toHaveBeenCalledWith(scenarioSteps);
			expect(updateChain.set).toHaveBeenCalledWith({
				stepOrder: 2,
				messageType: "text",
			});
			expect(updateChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "eq",
					left: scenarioSteps.id,
					right: "step-1",
				}),
			);
		});

		it("scenarioRepo_updateStep_emptyUpdates_shouldNotCallUpdate", async () => {
			const db = {
				update: vi.fn(),
			};
			const repository = createScenarioRepository(db as never);

			await repository.updateStep("step-1" as ScenarioStepId, {});

			expect(db.update).not.toHaveBeenCalled();
		});
	});

	describe("getDueDeliveries", () => {
		it("scenarioRepo_getDueDeliveries_shouldReturnDueOnly", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-03-03T10:15:00.000Z"));
			const dueRows = [{ id: "enrollment-1", scenarioId: "scenario-1", friendId: "friend-1" }];
			const selectChain = createSelectWhereLimitChain(dueRows);
			const db = {
				select: vi.fn().mockReturnValueOnce(selectChain),
			};
			const repository = createScenarioRepository(db as never);

			const result = await repository.getDueDeliveries();

			expect(result).toEqual(dueRows);
			expect(db.select).toHaveBeenCalledTimes(1);
			expect(selectChain.limit).toHaveBeenCalledWith(500);
			expect(selectChain.where).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "and",
					conditions: expect.arrayContaining([
						expect.objectContaining({ kind: "eq", left: friendScenarios.status, right: "active" }),
						expect.objectContaining({
							kind: "sql",
							values: expect.arrayContaining(["2026-03-03T10:15:00.000Z"]),
						}),
					]),
				}),
			);
		});
	});
});
