import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { boolean, id, timestamps } from "./_common.js";
import { friends } from "./crm.js";

export const reminders = sqliteTable("reminders", {
	id: id(),
	name: text("name").notNull(),
	description: text("description"),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

export const remindersRelations = relations(reminders, ({ many }) => ({
	steps: many(reminderSteps),
	friendReminders: many(friendReminders),
}));

export const reminderSteps = sqliteTable(
	"reminder_steps",
	{
		id: id(),
		reminderId: text("reminder_id")
			.notNull()
			.references(() => reminders.id),
		offsetMinutes: integer("offset_minutes").notNull(),
		messageType: text("message_type").notNull(),
		messageContent: text("message_content").notNull(),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [index("idx_reminder_steps_reminder").on(table.reminderId)],
);

export const reminderStepsRelations = relations(reminderSteps, ({ one }) => ({
	reminder: one(reminders, { fields: [reminderSteps.reminderId], references: [reminders.id] }),
}));

export const friendReminders = sqliteTable(
	"friend_reminders",
	{
		id: id(),
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		reminderId: text("reminder_id")
			.notNull()
			.references(() => reminders.id),
		targetDate: text("target_date").notNull(),
		status: text("status").notNull().default("active"),
		...timestamps,
	},
	(table) => [
		index("idx_friend_reminders_status").on(table.status),
		index("idx_friend_reminders_friend").on(table.friendId),
	],
);

export const friendRemindersRelations = relations(friendReminders, ({ one }) => ({
	friend: one(friends, { fields: [friendReminders.friendId], references: [friends.id] }),
	reminder: one(reminders, { fields: [friendReminders.reminderId], references: [reminders.id] }),
}));

export const friendReminderDeliveries = sqliteTable(
	"friend_reminder_deliveries",
	{
		id: id(),
		friendReminderId: text("friend_reminder_id")
			.notNull()
			.references(() => friendReminders.id),
		reminderStepId: text("reminder_step_id")
			.notNull()
			.references(() => reminderSteps.id),
		deliveredAt: text("delivered_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [unique("uq_reminder_delivery").on(table.friendReminderId, table.reminderStepId)],
);
