import { relations } from "drizzle-orm";
// biome-ignore lint/suspicious/noDeprecatedImports: primaryKey is the only Drizzle API for composite PKs; the deprecated overload is not used here
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { audit, boolean, id, softDelete, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";

// =============================================================================
// Friends
// =============================================================================
export const friends = sqliteTable(
	"friends",
	{
		id: id(),
		lineUserId: text("line_user_id").unique().notNull(),
		displayName: text("display_name"),
		pictureUrl: text("picture_url"),
		statusMessage: text("status_message"),
		isFollowing: boolean("is_following").notNull().default(true),
		userId: text("user_id"),
		score: integer("score").notNull().default(0),
		metadata: text("metadata"),
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),
		...timestamps,
		...softDelete,
		...audit,
	},
	(table) => [
		index("idx_friends_line_user_id").on(table.lineUserId),
		index("idx_friends_user_id").on(table.userId),
		index("idx_friends_account_following").on(table.lineAccountId, table.isFollowing),
		index("idx_friends_deleted_account").on(table.deletedAt, table.lineAccountId),
	],
);

// friendsRelations moved to ./_relations.ts to avoid circular imports

// =============================================================================
// Tags
// =============================================================================
export const tags = sqliteTable("tags", {
	id: id(),
	name: text("name").unique().notNull(),
	color: text("color").notNull().default("#3B82F6"),
	createdAt: timestamps.createdAt,
});

export const tagsRelations = relations(tags, ({ many }) => ({
	friends: many(friendTags),
}));

// =============================================================================
// Friend <-> Tag join
// =============================================================================
export const friendTags = sqliteTable(
	"friend_tags",
	{
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		tagId: text("tag_id")
			.notNull()
			.references(() => tags.id),
		assignedAt: text("assigned_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [primaryKey({ columns: [table.friendId, table.tagId] }), index("idx_friend_tags_tag_id").on(table.tagId)],
);

export const friendTagsRelations = relations(friendTags, ({ one }) => ({
	friend: one(friends, { fields: [friendTags.friendId], references: [friends.id] }),
	tag: one(tags, { fields: [friendTags.tagId], references: [tags.id] }),
}));

// =============================================================================
// Messages Log
// =============================================================================
export const messagesLog = sqliteTable(
	"messages_log",
	{
		id: id(),
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		direction: text("direction").notNull(), // incoming | outgoing
		messageType: text("message_type").notNull(),
		content: text("content").notNull(),
		broadcastId: text("broadcast_id"),
		scenarioStepId: text("scenario_step_id"),
		deliveryType: text("delivery_type"), // push | reply
		createdAt: timestamps.createdAt,
	},
	(table) => [
		index("idx_messages_log_friend_id").on(table.friendId),
		index("idx_messages_log_created_at").on(table.createdAt),
		index("idx_messages_log_friend_created").on(table.friendId, table.createdAt),
	],
);

export const messagesLogRelations = relations(messagesLog, ({ one }) => ({
	friend: one(friends, { fields: [messagesLog.friendId], references: [friends.id] }),
}));

// =============================================================================
// Auto Replies
// =============================================================================
export const autoReplies = sqliteTable(
	"auto_replies",
	{
		id: id(),
		keyword: text("keyword").notNull(),
		matchType: text("match_type").notNull().default("exact"),
		responseType: text("response_type").notNull().default("text"),
		responseContent: text("response_content").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		priority: integer("priority").notNull().default(0),
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),
		createdAt: timestamps.createdAt,
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_auto_replies_line_account_id").on(table.lineAccountId),
		index("idx_auto_replies_priority").on(table.priority),
	],
);

export const autoRepliesRelations = relations(autoReplies, ({ many }) => ({
	messages: many(autoReplyMessages),
}));

// =============================================================================
// Auto Reply Messages (1 auto_reply -> up to 5 messages)
// =============================================================================
export const autoReplyMessages = sqliteTable(
	"auto_reply_messages",
	{
		id: id(),
		autoReplyId: text("auto_reply_id")
			.notNull()
			.references(() => autoReplies.id),
		messageOrder: integer("message_order").notNull(), // 1-5
		messageType: text("message_type").notNull().default("text"),
		messageContent: text("message_content").notNull(),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_auto_reply_messages_reply").on(table.autoReplyId),
		index("idx_auto_reply_messages_order").on(table.autoReplyId, table.messageOrder),
	],
);

export const autoReplyMessagesRelations = relations(autoReplyMessages, ({ one }) => ({
	autoReply: one(autoReplies, { fields: [autoReplyMessages.autoReplyId], references: [autoReplies.id] }),
}));
