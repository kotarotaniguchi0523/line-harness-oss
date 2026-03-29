import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { audit, id, softDelete, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";

export const broadcasts = sqliteTable(
	"broadcasts",
	{
		id: id(),
		title: text("title").notNull(),
		messageType: text("message_type").notNull(),
		messageContent: text("message_content").notNull(),
		targetType: text("target_type").notNull().default("all"),
		targetTagId: text("target_tag_id"),
		status: text("status").notNull().default("draft"),
		scheduledAt: text("scheduled_at"),
		sentAt: text("sent_at"),
		totalCount: integer("total_count").notNull().default(0),
		successCount: integer("success_count").notNull().default(0),
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),
		createdAt: timestamps.createdAt,
		...softDelete,
		...audit,
	},
	(table) => [
		index("idx_broadcasts_status").on(table.status),
		index("idx_broadcasts_status_scheduled").on(table.status, table.scheduledAt),
		index("idx_broadcasts_deleted_status").on(table.deletedAt, table.status),
		index("idx_broadcasts_line_account_id").on(table.lineAccountId),
	],
);
