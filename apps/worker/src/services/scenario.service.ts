// =============================================================================
// Scenario Service - Marketing Bounded Context
//
// Unified service with CQRS separation at the type level.
// Read-only queries go directly to the repository layer.
// Write commands validate input via Zod schemas, enforce business rules,
// and delegate to the repository for persistence. Authorization is enforced
// on both sides.
// =============================================================================

import { CreateScenarioSchema, CreateScenarioStepSchema, ScenarioTriggerType } from "@line-crm/contracts";
import type { Database } from "@line-crm/db/drizzle";
import { createScenarioRepository } from "@line-crm/db/repositories/scenario.repository";
import type { FriendId, LineAccountId, ScenarioId, ScenarioStepId, TagId } from "@line-crm/domain";
import {
	assertReadAccess,
	assertWriteAccess,
	type CommandResult,
	CommonErrors,
	err,
	ok,
	type QueryResult,
	type StaffContext,
} from "./cqrs-types.js";

// ---------------------------------------------------------------------------
// Repository return type helpers (inferred from the repo layer)
// ---------------------------------------------------------------------------

type ScenarioRepo = ReturnType<typeof createScenarioRepository>;
type ScenarioListResult = Awaited<ReturnType<ScenarioRepo["list"]>>;
type ScenarioDetail = NonNullable<Awaited<ReturnType<ScenarioRepo["findById"]>>>;
type ScenarioActiveResult = Awaited<ReturnType<ScenarioRepo["listActive"]>>;

// ---------------------------------------------------------------------------
// Error codes specific to scenario commands
// ---------------------------------------------------------------------------

const ScenarioCommandErrors = {
	...CommonErrors,
	TRIGGER_TAG_REQUIRED: "TRIGGER_TAG_REQUIRED",
	ALREADY_ENROLLED: "ALREADY_ENROLLED",
} as const;

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

const Messages = {
	INSUFFICIENT_READ: "Insufficient permissions to read scenario data",
	INSUFFICIENT_WRITE: "Only owner or admin can modify scenarios",
	SCENARIO_NOT_FOUND: "Scenario not found",
	TAG_REQUIRED_FOR_TAG_TRIGGER: "triggerTagId is required when triggerType is 'tag_added'",
	CREATE_VALIDATION_FAILED: "Scenario creation input failed validation",
	STEP_VALIDATION_FAILED: "Scenario step input failed validation",
	FRIEND_ALREADY_ENROLLED: "Friend is already enrolled in this scenario",
} as const;

// ---------------------------------------------------------------------------
// Command DTOs -- explicit data structures for each mutation
// ---------------------------------------------------------------------------

export interface CreateScenarioCommand {
	readonly name: string;
	readonly description?: string;
	readonly triggerType: ScenarioTriggerType;
	readonly triggerTagId?: TagId;
	readonly lineAccountId?: LineAccountId;
}

export interface AddStepCommand {
	readonly scenarioId: ScenarioId;
	readonly stepOrder: number;
	readonly delayMinutes: number;
	readonly messageType: string;
	readonly messageContent: string;
	readonly conditionType?: string;
	readonly conditionValue?: string;
	readonly nextStepOnFalse?: number;
}

export interface RemoveStepCommand {
	readonly stepId: ScenarioStepId;
}

export interface SetActiveCommand {
	readonly scenarioId: ScenarioId;
	readonly isActive: boolean;
}

export interface DeleteScenarioCommand {
	readonly scenarioId: ScenarioId;
}

export interface EnrollFriendCommand {
	readonly friendId: FriendId;
	readonly scenarioId: ScenarioId;
	readonly nextDeliveryAt: string | null;
}

// ---------------------------------------------------------------------------
// Factory: create scenario service bound to a database instance
// ---------------------------------------------------------------------------

export function createScenarioService(db: Database) {
	const repo = createScenarioRepository(db);

	const queries = {
		/**
		 * List all scenarios, optionally scoped to a line account.
		 * Enforces read authorization.
		 */
		async listScenarios(staff: StaffContext, lineAccountId?: LineAccountId): Promise<QueryResult<ScenarioListResult>> {
			const authError = assertReadAccess(staff, Messages.INSUFFICIENT_READ);
			if (authError) return err(authError);

			const result = await repo.list(lineAccountId);
			return ok(result);
		},

		/**
		 * Get a single scenario by ID with its steps.
		 * Enforces read authorization.
		 */
		async getScenario(staff: StaffContext, id: ScenarioId): Promise<QueryResult<ScenarioDetail>> {
			const authError = assertReadAccess(staff, Messages.INSUFFICIENT_READ);
			if (authError) return err(authError);

			const scenario = await repo.findById(id);
			if (!scenario) {
				return err({
					code: CommonErrors.NOT_FOUND,
					message: Messages.SCENARIO_NOT_FOUND,
				});
			}
			return ok(scenario);
		},

		/**
		 * List only active scenarios, optionally scoped to a line account.
		 * Enforces read authorization.
		 */
		async listActive(staff: StaffContext, lineAccountId?: LineAccountId): Promise<QueryResult<ScenarioActiveResult>> {
			const authError = assertReadAccess(staff, Messages.INSUFFICIENT_READ);
			if (authError) return err(authError);

			const result = await repo.listActive(lineAccountId);
			return ok(result);
		},
	};

	const commands = {
		/**
		 * Create a new scenario.
		 * Validates input via CreateScenarioSchema.
		 * Enforces: triggerType === 'tag_added' requires triggerTagId.
		 * Only owner/admin can create scenarios.
		 */
		async createScenario(staff: StaffContext, data: CreateScenarioCommand): Promise<CommandResult<string>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			// Schema validation
			const parseResult = CreateScenarioSchema.safeParse(data);
			if (!parseResult.success) {
				return err({
					code: ScenarioCommandErrors.VALIDATION_FAILED,
					message: Messages.CREATE_VALIDATION_FAILED,
					details: { issues: parseResult.error.issues },
				});
			}
			const validated = parseResult.data;

			// Business rule: tag_added trigger requires triggerTagId
			if (validated.triggerType === ScenarioTriggerType.enum.tag_added && !validated.triggerTagId) {
				return err({
					code: ScenarioCommandErrors.TRIGGER_TAG_REQUIRED,
					message: Messages.TAG_REQUIRED_FOR_TAG_TRIGGER,
				});
			}

			const id = await repo.create({
				name: validated.name,
				description: validated.description,
				triggerType: validated.triggerType,
				triggerTagId: validated.triggerTagId ? (validated.triggerTagId as TagId) : undefined,
				lineAccountId: validated.lineAccountId ? (validated.lineAccountId as LineAccountId) : undefined,
			});
			return ok(id);
		},

		/**
		 * Add a step to a scenario.
		 * Validates input via CreateScenarioStepSchema.
		 * Only owner/admin can modify scenario steps.
		 */
		async addStep(
			staff: StaffContext,
			scenarioId: ScenarioId,
			data: Omit<AddStepCommand, "scenarioId">,
		): Promise<CommandResult<string>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			const parseResult = CreateScenarioStepSchema.safeParse(data);
			if (!parseResult.success) {
				return err({
					code: ScenarioCommandErrors.VALIDATION_FAILED,
					message: Messages.STEP_VALIDATION_FAILED,
					details: { issues: parseResult.error.issues },
				});
			}

			const id = await repo.addStep(scenarioId, parseResult.data);
			return ok(id);
		},

		/**
		 * Remove a step from a scenario.
		 * Only owner/admin can modify scenario steps.
		 */
		async removeStep(staff: StaffContext, stepId: ScenarioStepId): Promise<CommandResult<void>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			await repo.removeStep(stepId);
			return ok(undefined);
		},

		/**
		 * Set scenario active state declaratively.
		 * The target state is explicitly passed (not toggled).
		 * Only owner/admin can change scenario status.
		 */
		async setActive(staff: StaffContext, id: ScenarioId, isActive: boolean): Promise<CommandResult<void>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			await repo.setActive(id, isActive);
			return ok(undefined);
		},

		/**
		 * Soft-delete a scenario.
		 * Only owner/admin can delete scenarios.
		 */
		async deleteScenario(staff: StaffContext, id: ScenarioId): Promise<CommandResult<void>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			await repo.delete(id);
			return ok(undefined);
		},

		/**
		 * Enroll a friend in a scenario.
		 * Uses onConflictDoNothing at the repository level for idempotency.
		 * Only owner/admin can enroll friends.
		 */
		async enrollFriend(staff: StaffContext, cmd: EnrollFriendCommand): Promise<CommandResult<string>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			const id = await repo.enrollFriend(cmd.friendId, cmd.scenarioId, cmd.nextDeliveryAt);
			return ok(id);
		},
	};

	return { queries, commands };
}

// ---------------------------------------------------------------------------
// Exported types for consumers that need the handler shapes
// ---------------------------------------------------------------------------

export type ScenarioService = ReturnType<typeof createScenarioService>;
export type ScenarioQueries = ScenarioService["queries"];
export type ScenarioCommands = ScenarioService["commands"];
