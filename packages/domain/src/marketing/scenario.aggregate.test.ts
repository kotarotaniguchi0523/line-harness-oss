import { describe, expect, it } from "vitest";
import { lineAccountId, scenarioId, scenarioStepId, tagId } from "../shared/branded.js";
import { ErrorCodes, ErrorMessages } from "../shared/result.js";
import { ScenarioAggregate, type ScenarioStepProps } from "./scenario.aggregate.js";

const TEST_SCENARIO = "11111111-1111-1111-1111-111111111111";
const TEST_ACCOUNT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEST_TAG_1 = "22222222-2222-2222-2222-222222222222";
const TEST_STEP_1 = "33333333-3333-3333-3333-333333333331";
const TEST_STEP_2 = "33333333-3333-3333-3333-333333333332";

function createScenarioAggregate() {
	return ScenarioAggregate.create(scenarioId(TEST_SCENARIO), {
		name: "Welcome Scenario",
		description: "Onboard new friends",
		triggerType: "friend_add",
		triggerTagId: tagId(TEST_TAG_1),
		isActive: false,
		lineAccountId: lineAccountId(TEST_ACCOUNT),
	});
}

const stepUuids = [TEST_STEP_1, TEST_STEP_2];

function createStep(stepOrder: number): ScenarioStepProps {
	return {
		id: scenarioStepId(stepUuids[stepOrder - 1] ?? `44444444-4444-4444-4444-44444444444${stepOrder}`),
		stepOrder,
		delayMinutes: stepOrder * 10,
		messageType: "text",
		messageContent: `Step ${stepOrder}`,
		conditionType: null,
		conditionValue: null,
		nextStepOnFalse: null,
	};
}

describe("ScenarioAggregate", () => {
	it("scenarioAggregate_create_shouldInitializeWithEmptySteps", () => {
		const aggregate = createScenarioAggregate();

		const steps = aggregate.steps;

		expect(steps).toEqual([]);
	});

	it("scenarioAggregate_addStep_shouldAddToStepsList", () => {
		const aggregate = createScenarioAggregate();
		const step = createStep(1);

		const result = aggregate.addStep(step);

		expect(result.isOk()).toBe(true);
		expect(aggregate.steps).toEqual([step]);
	});

	it("scenarioAggregate_addStep_shouldSortByStepOrder", () => {
		const aggregate = createScenarioAggregate();
		const laterStep = createStep(2);
		const earlierStep = createStep(1);

		aggregate.addStep(laterStep);
		aggregate.addStep(earlierStep);

		expect(aggregate.steps.map((step) => step.stepOrder)).toEqual([1, 2]);
	});

	it("scenarioAggregate_addStep_duplicateOrder_shouldReturnDomainError", () => {
		const aggregate = createScenarioAggregate();
		aggregate.addStep(createStep(1));

		const result = aggregate.addStep(createStep(1));

		expect(result.isErr()).toBe(true);
		const error = result._unsafeUnwrapErr();
		expect(error.code).toBe(ErrorCodes.DUPLICATE_ORDER);
		expect(error.message).toBe(ErrorMessages.STEP_ORDER_ALREADY_EXISTS);
		expect(error.context).toEqual({ stepOrder: 1 });
	});

	it("scenarioAggregate_removeStep_shouldRemoveFromList", () => {
		const aggregate = createScenarioAggregate();
		aggregate.addStep(createStep(1));
		aggregate.addStep(createStep(2));

		const result = aggregate.removeStep(1);

		expect(result.isOk()).toBe(true);
		expect(aggregate.steps.map((step) => step.stepOrder)).toEqual([2]);
	});

	it("scenarioAggregate_removeStep_nonExistent_shouldReturnDomainError", () => {
		const aggregate = createScenarioAggregate();

		const result = aggregate.removeStep(99);

		expect(result.isErr()).toBe(true);
		const error = result._unsafeUnwrapErr();
		expect(error.code).toBe(ErrorCodes.STEP_NOT_FOUND);
		expect(error.message).toBe(ErrorMessages.STEP_ORDER_NOT_FOUND);
		expect(error.context).toEqual({ stepOrder: 99 });
	});

	it("scenarioAggregate_activate_shouldSetIsActiveTrue", () => {
		const aggregate = createScenarioAggregate();

		aggregate.activate();

		expect(aggregate.isActive).toBe(true);
	});

	it("scenarioAggregate_deactivate_shouldSetIsActiveFalse", () => {
		const aggregate = createScenarioAggregate();
		aggregate.activate();

		aggregate.deactivate();

		expect(aggregate.isActive).toBe(false);
	});
});
