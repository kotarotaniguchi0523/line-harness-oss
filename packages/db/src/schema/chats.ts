import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, id, timestamps } from "./_common.js";
import { friends } from "./crm.js";

// =============================================================================
// Operators -- staff who handle chat sessions
// =============================================================================

export const operators = sqliteTable("operators", {
	id: id(),
	name: text("name").notNull(),
	email: text("email").unique().notNull(),
	role: text("role").notNull().default("operator"),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

// =============================================================================
// Chat source type values (LINE event sources)
// =============================================================================

/**
 * Allowed values for `chats.sourceType`.
 * Matches LINE webhook event source types.
 * - "user"  : 1-on-1 direct message
 * - "group" : LINE group chat
 * - "room"  : LINE multi-person chat (legacy room)
 */
export const CHAT_SOURCE_TYPES = ["user", "group", "room"] as const;
export type ChatSourceType = (typeof CHAT_SOURCE_TYPES)[number];

// =============================================================================
// Chats -- conversation sessions (1-on-1 and group/room)
// =============================================================================

export const chats = sqliteTable(
	"chats",
	{
		id: id(),

		// -- Source identification ------------------------------------------------
		/** LINE event source type: "user" | "group" | "room" */
		sourceType: text("source_type").notNull().default("user"),
		/** LINE group ID (present when sourceType = "group") */
		groupId: text("group_id"),
		/** LINE room ID (present when sourceType = "room") */
		roomId: text("room_id"),

		// -- Friend / operator assignment -----------------------------------------
		/** Friend who owns or participated in the chat (nullable for group chats) */
		friendId: text("friend_id").references(() => friends.id),
		/** Operator currently assigned to the chat */
		operatorId: text("operator_id").references(() => operators.id),

		// -- Chat metadata --------------------------------------------------------
		status: text("status").notNull().default("unread"),
		notes: text("notes"),
		lastMessageAt: text("last_message_at"),

		// -- Cached group/room info -----------------------------------------------
		/** Cached display name of the group or room */
		groupName: text("group_name"),
		/** Cached group picture URL from LINE */
		groupPictureUrl: text("group_picture_url"),
		/** Cached member count of the group/room */
		memberCount: integer("member_count"),

		...timestamps,
	},
	(table) => [
		index("idx_chats_friend").on(table.friendId),
		index("idx_chats_operator").on(table.operatorId),
		index("idx_chats_status").on(table.status),
		index("idx_chats_source_type").on(table.sourceType),
		index("idx_chats_group_id").on(table.groupId),
	],
);

// =============================================================================
// Relations
// =============================================================================

export const chatsRelations = relations(chats, ({ one }) => ({
	friend: one(friends, { fields: [chats.friendId], references: [friends.id] }),
	operator: one(operators, { fields: [chats.operatorId], references: [operators.id] }),
}));
