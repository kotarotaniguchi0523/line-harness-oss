import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, id, jsonText, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";
import { friends } from "./crm.js";

export const automations = sqliteTable(
	"automations",
	{
		id: id(),
		name: text("name").notNull(),
		description: text("description"),
		eventType: text("event_type").notNull(),
		conditions: jsonText("conditions"),
		actions: jsonText("actions", "[]"),
		isActive: boolean("is_active").notNull().default(true),
		priority: integer("priority").notNull().default(0),
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),
		...timestamps,
	},
	(table) => [
		index("idx_automations_event").on(table.eventType),
		index("idx_automations_active").on(table.isActive),
		index("idx_automations_event_active").on(table.eventType, table.isActive),
		index("idx_automations_line_account_id").on(table.lineAccountId),
	],
);

export const automationsRelations = relations(automations, ({ many }) => ({
	logs: many(automationLogs),
}));

export const automationLogs = sqliteTable(
	"automation_logs",
	{
		id: id(),
		automationId: text("automation_id")
			.notNull()
			.references(() => automations.id),
		friendId: text("friend_id").references(() => friends.id),
		eventData: text("event_data"),
		actionsResult: text("actions_result"),
		status: text("status").notNull().default("success"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [index("idx_automation_logs_automation").on(table.automationId)],
);

export const automationLogsRelations = relations(automationLogs, ({ one }) => ({
	automation: one(automations, { fields: [automationLogs.automationId], references: [automations.id] }),
}));
