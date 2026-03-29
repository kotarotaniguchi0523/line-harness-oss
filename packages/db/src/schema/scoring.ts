import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, id, timestamps } from "./_common.js";
import { friends } from "./crm.js";

export const scoringRules = sqliteTable("scoring_rules", {
	id: id(),
	name: text("name").notNull(),
	eventType: text("event_type").notNull(),
	scoreValue: integer("score_value").notNull(),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

export const friendScores = sqliteTable(
	"friend_scores",
	{
		id: id(),
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		scoringRuleId: text("scoring_rule_id").references(() => scoringRules.id),
		scoreChange: integer("score_change").notNull(),
		reason: text("reason"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_friend_scores_friend").on(table.friendId),
		index("idx_friend_scores_created").on(table.createdAt),
	],
);

export const friendScoresRelations = relations(friendScores, ({ one }) => ({
	friend: one(friends, { fields: [friendScores.friendId], references: [friends.id] }),
}));
