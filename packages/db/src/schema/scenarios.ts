import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { audit, boolean, id, softDelete, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";
import { friends } from "./crm.js";

// =============================================================================
// Scenarios
// =============================================================================
export const scenarios = sqliteTable(
	"scenarios",
	{
		id: id(),
		name: text("name").notNull(),
		description: text("description"),
		triggerType: text("trigger_type").notNull(), // friend_add | tag_added | manual
		triggerTagId: text("trigger_tag_id"),
		isActive: boolean("is_active").notNull().default(true),
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),
		...timestamps,
		...softDelete,
		...audit,
	},
	(table) => [
		index("idx_scenarios_deleted_account").on(table.deletedAt, table.lineAccountId),
		index("idx_scenarios_deleted_active").on(table.deletedAt, table.isActive),
		index("idx_scenarios_line_account_id").on(table.lineAccountId),
	],
);

export const scenariosRelations = relations(scenarios, ({ many }) => ({
	steps: many(scenarioSteps),
	enrollments: many(friendScenarios),
}));

// =============================================================================
// Scenario Steps
// =============================================================================
export const scenarioSteps = sqliteTable(
	"scenario_steps",
	{
		id: id(),
		scenarioId: text("scenario_id")
			.notNull()
			.references(() => scenarios.id),
		stepOrder: integer("step_order").notNull(),
		delayMinutes: integer("delay_minutes").notNull().default(0),
		messageType: text("message_type").notNull(), // text | image | flex
		messageContent: text("message_content").notNull(),
		conditionType: text("condition_type"),
		conditionValue: text("condition_value"),
		nextStepOnFalse: integer("next_step_on_false"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_scenario_steps_scenario_id").on(table.scenarioId),
		unique("uq_scenario_step_order").on(table.scenarioId, table.stepOrder),
	],
);

export const scenarioStepsRelations = relations(scenarioSteps, ({ one }) => ({
	scenario: one(scenarios, { fields: [scenarioSteps.scenarioId], references: [scenarios.id] }),
}));

// =============================================================================
// Friend Scenario Enrollments
// =============================================================================
export const friendScenarios = sqliteTable(
	"friend_scenarios",
	{
		id: id(),
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		scenarioId: text("scenario_id")
			.notNull()
			.references(() => scenarios.id),
		currentStepOrder: integer("current_step_order").notNull().default(0),
		status: text("status").notNull().default("active"), // active | paused | completed
		startedAt: text("started_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		nextDeliveryAt: text("next_delivery_at"),
		...{
			updatedAt: text("updated_at")
				.notNull()
				.$defaultFn(() => new Date().toISOString()),
		},
	},
	(table) => [
		unique("uq_friend_scenario_enrollment").on(table.friendId, table.scenarioId),
		index("idx_friend_scenarios_next_delivery_at").on(table.nextDeliveryAt),
		index("idx_friend_scenarios_status").on(table.status),
		index("idx_friend_scenarios_friend_id").on(table.friendId),
		index("idx_friend_scenarios_status_delivery").on(table.status, table.nextDeliveryAt),
	],
);

export const friendScenariosRelations = relations(friendScenarios, ({ one }) => ({
	friend: one(friends, { fields: [friendScenarios.friendId], references: [friends.id] }),
	scenario: one(scenarios, { fields: [friendScenarios.scenarioId], references: [scenarios.id] }),
}));
