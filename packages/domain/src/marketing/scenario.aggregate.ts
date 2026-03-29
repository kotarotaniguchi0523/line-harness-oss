// =============================================================================
// Scenario Aggregate Root
//
// Props are split into Config (性質/不変) and MutableState (状態/変化).
// The aggregate holds both via ScenarioProps = ScenarioConfig & ScenarioMutableState.
// =============================================================================

import { AggregateRoot } from "../shared/aggregate.js";
import type { LineAccountId, ScenarioId, ScenarioStepId, TagId } from "../shared/branded.js";
import type { Result } from "../shared/result.js";
import { type DomainError, domainError, ErrorCodes, ErrorMessages, err, ok } from "../shared/result.js";

// =============================================================================
// Config (性質 -- 作成時に決定、以後不変)
// =============================================================================

export type ScenarioTriggerType = "friend_add" | "tag_added" | "manual";

interface ScenarioConfig {
	readonly name: string;
	readonly description: string | null;
	readonly triggerType: ScenarioTriggerType;
	readonly triggerTagId: TagId | null;
	readonly lineAccountId: LineAccountId | null;
}

// =============================================================================
// Step Props (性質 -- ステップ定義)
// =============================================================================

export interface ScenarioStepProps {
	id: ScenarioStepId;
	stepOrder: number;
	delayMinutes: number;
	messageType: string;
	messageContent: string;
	conditionType: string | null;
	conditionValue: string | null;
	nextStepOnFalse: number | null;
}

// =============================================================================
// Mutable State (状態 -- 時間とともに変化する)
// =============================================================================

interface ScenarioMutableState {
	isActive: boolean;
	steps: ScenarioStepProps[];
}

// =============================================================================
// Aggregate Props (Config + MutableState の合成)
// =============================================================================

export interface ScenarioProps extends ScenarioConfig, ScenarioMutableState {}

// =============================================================================
// Aggregate Root
// =============================================================================

export class ScenarioAggregate extends AggregateRoot<ScenarioId> {
	private constructor(
		id: ScenarioId,
		private props: ScenarioProps,
	) {
		super(id);
	}

	// ---------------------------------------------------------------------------
	// Factory
	// ---------------------------------------------------------------------------

	static create(id: ScenarioId, config: Omit<ScenarioProps, "steps">): ScenarioAggregate {
		return new ScenarioAggregate(id, { ...config, steps: [] });
	}

	static reconstitute(id: ScenarioId, props: ScenarioProps): ScenarioAggregate {
		return new ScenarioAggregate(id, props);
	}

	// ---------------------------------------------------------------------------
	// Queries -- 性質を返す (Config getters)
	// ---------------------------------------------------------------------------

	get name(): string {
		return this.props.name;
	}
	get description(): string | null {
		return this.props.description;
	}
	get triggerType(): ScenarioTriggerType {
		return this.props.triggerType;
	}
	get triggerTagId(): TagId | null {
		return this.props.triggerTagId;
	}
	get lineAccountId(): LineAccountId | null {
		return this.props.lineAccountId;
	}

	// ---------------------------------------------------------------------------
	// Queries -- 状態を返す (State getters)
	// ---------------------------------------------------------------------------

	get isActive(): boolean {
		return this.props.isActive;
	}
	get steps(): readonly ScenarioStepProps[] {
		return this.props.steps;
	}

	// ---------------------------------------------------------------------------
	// Commands -- 状態を変更する (State mutations)
	// ---------------------------------------------------------------------------

	addStep(step: ScenarioStepProps): Result<void, DomainError> {
		const exists = this.props.steps.find((s) => s.stepOrder === step.stepOrder);
		if (exists) {
			return err(
				domainError(ErrorCodes.DUPLICATE_ORDER, ErrorMessages.STEP_ORDER_ALREADY_EXISTS, {
					stepOrder: step.stepOrder,
				}),
			);
		}
		this.props.steps.push(step);
		this.props.steps.sort((a, b) => a.stepOrder - b.stepOrder);
		return ok(undefined);
	}

	removeStep(stepOrder: number): Result<void, DomainError> {
		const idx = this.props.steps.findIndex((s) => s.stepOrder === stepOrder);
		if (idx === -1) {
			return err(
				domainError(ErrorCodes.STEP_NOT_FOUND, ErrorMessages.STEP_ORDER_NOT_FOUND, {
					stepOrder,
				}),
			);
		}
		this.props.steps.splice(idx, 1);
		return ok(undefined);
	}

	activate(): void {
		this.props.isActive = true;
	}
	deactivate(): void {
		this.props.isActive = false;
	}
}
