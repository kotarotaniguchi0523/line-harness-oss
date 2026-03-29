// =============================================================================
// Scenarios RPC - Cap'n Web RpcTarget
//
// Thin presentation layer: validates input, delegates to ScenarioService,
// and converts service Result to RPC response (throw on error).
// =============================================================================

import { type AddScenarioStepCommand, type CreateScenarioCommand, UuidSchema } from "@line-crm/contracts";
import type { Database } from "@line-crm/db/drizzle";
import { scenarioId, scenarioStepId, lineAccountId as toLineAccountId, tagId as toTagId } from "@line-crm/domain";
import { RpcTarget } from "capnweb";
import { z } from "zod";
import { createScenarioService, type ScenarioCommands, type ScenarioQueries } from "../services/scenario.service.js";

import type { StaffContext } from "./types.js";
import { formatZodError, throwServiceError } from "./utils.js";

// ---------------------------------------------------------------------------
// RPC Target
// ---------------------------------------------------------------------------

export class ScenariosRpc extends RpcTarget {
	private queries: ScenarioQueries;
	private commands: ScenarioCommands;

	constructor(
		db: Database,
		private staff: StaffContext,
	) {
		super();
		const service = createScenarioService(db);
		this.queries = service.queries;
		this.commands = service.commands;
	}

	async list(lineAccountId?: string) {
		let validAccountId: string | undefined;
		if (lineAccountId) {
			const accountIdResult = UuidSchema.safeParse(lineAccountId);
			if (!accountIdResult.success) {
				throw new Error(formatZodError(accountIdResult.error));
			}
			validAccountId = accountIdResult.data;
		}

		const serviceResult = await this.queries.listScenarios(
			this.staff,
			validAccountId ? toLineAccountId(validAccountId) : undefined,
		);

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}

	async get(id: string) {
		const idResult = UuidSchema.safeParse(id);
		if (!idResult.success) {
			throw new Error(formatZodError(idResult.error));
		}

		const serviceResult = await this.queries.getScenario(this.staff, scenarioId(idResult.data));

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}

	async create(data: Omit<CreateScenarioCommand, "staffId">) {
		const serviceResult = await this.commands.createScenario(this.staff, {
			name: data.name,
			description: data.description,
			triggerType: data.triggerType,
			triggerTagId: data.triggerTagId ? toTagId(data.triggerTagId) : undefined,
			lineAccountId: data.lineAccountId ? toLineAccountId(data.lineAccountId) : undefined,
		});

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}

	async addStep(sId: string, data: Omit<AddScenarioStepCommand, "scenarioId" | "staffId">) {
		const scenarioIdResult = UuidSchema.safeParse(sId);
		if (!scenarioIdResult.success) {
			throw new Error(formatZodError(scenarioIdResult.error));
		}

		const serviceResult = await this.commands.addStep(this.staff, scenarioId(scenarioIdResult.data), data);

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}

	async removeStep(stepId: string) {
		const stepIdResult = UuidSchema.safeParse(stepId);
		if (!stepIdResult.success) {
			throw new Error(formatZodError(stepIdResult.error));
		}

		const serviceResult = await this.commands.removeStep(this.staff, scenarioStepId(stepIdResult.data));

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
	}

	async setActive(id: string, isActive: boolean) {
		const idResult = UuidSchema.safeParse(id);
		if (!idResult.success) {
			throw new Error(formatZodError(idResult.error));
		}
		const activeResult = z.boolean().safeParse(isActive);
		if (!activeResult.success) {
			throw new Error(formatZodError(activeResult.error));
		}

		const serviceResult = await this.commands.setActive(this.staff, scenarioId(idResult.data), activeResult.data);

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
	}

	async delete(id: string) {
		const idResult = UuidSchema.safeParse(id);
		if (!idResult.success) {
			throw new Error(formatZodError(idResult.error));
		}

		const serviceResult = await this.commands.deleteScenario(this.staff, scenarioId(idResult.data));

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
	}

	async listActive(lineAccountId?: string) {
		let validAccountId: string | undefined;
		if (lineAccountId) {
			const accountIdResult = UuidSchema.safeParse(lineAccountId);
			if (!accountIdResult.success) {
				throw new Error(formatZodError(accountIdResult.error));
			}
			validAccountId = accountIdResult.data;
		}

		const serviceResult = await this.queries.listActive(
			this.staff,
			validAccountId ? toLineAccountId(validAccountId) : undefined,
		);

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}
}
