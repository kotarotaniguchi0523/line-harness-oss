// =============================================================================
// LINE Audience Management Schema
// =============================================================================
// Manages LINE audiences (click, upload, impression) with expiry tracking.
// LINE audiences expire after 180 days — this schema tracks expiry and
// enables automatic rotation via cron batch.

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, id, softDelete, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";
import { tags } from "./crm.js";

// --- Audience Definition ---

export const audiences = sqliteTable(
	"audiences",
	{
		id: id(),
		/** LINE audience ID returned from Audience API */
		lineAudienceId: text("line_audience_id"),
		/** Display name for the audience */
		name: text("name").notNull(),
		/** Description */
		description: text("description"),
		/** Audience type: 'click' | 'upload' | 'impression' | 'ifa' */
		audienceType: text("audience_type").notNull(),
		/** Associated LINE account */
		lineAccountId: text("line_account_id")
			.notNull()
			.references(() => lineAccounts.id),
		/** Number of users in this audience */
		userCount: integer("user_count").notNull().default(0),
		/** Whether this audience is active and usable for targeting */
		isActive: boolean("is_active").notNull().default(true),
		/** LINE audience creation timestamp */
		lineCreatedAt: text("line_created_at"),
		/** LINE audience expiry date (180 days from creation) */
		expiresAt: text("expires_at"),
		/** If rotated, the ID of the replacement audience */
		rotatedToId: text("rotated_to_id"),
		/** Associated tag ID (if this audience is linked to a CRM tag) */
		tagId: text("tag_id").references(() => tags.id),
		/** For click audiences: the request_id from LINE broadcast/narrowcast */
		clickSourceRequestId: text("click_source_request_id"),
		/** For impression audiences: the request_id */
		impressionSourceRequestId: text("impression_source_request_id"),
		...timestamps,
		...softDelete,
	},
	(table) => [
		index("idx_audiences_account").on(table.lineAccountId),
		index("idx_audiences_type").on(table.audienceType),
		index("idx_audiences_expires").on(table.expiresAt),
		index("idx_audiences_tag").on(table.tagId),
		index("idx_audiences_active_expires").on(table.isActive, table.expiresAt),
		index("idx_audiences_line_id").on(table.lineAudienceId),
	],
);

// --- Audience Members (for upload audiences) ---

export const audienceMembers = sqliteTable(
	"audience_members",
	{
		id: id(),
		audienceId: text("audience_id")
			.notNull()
			.references(() => audiences.id),
		/** LINE user ID or IFA */
		identifier: text("identifier").notNull(),
		/** Identifier type: 'line_user_id' | 'ifa' */
		identifierType: text("identifier_type").notNull().default("line_user_id"),
		/** When this member was added */
		addedAt: text("added_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_audience_members_audience").on(table.audienceId),
		index("idx_audience_members_identifier").on(table.identifier),
	],
);

// --- Audience Rotation Log ---

export const audienceRotationLogs = sqliteTable(
	"audience_rotation_logs",
	{
		id: id(),
		/** Original audience that was expiring */
		originalAudienceId: text("original_audience_id")
			.notNull()
			.references(() => audiences.id),
		/** New audience that was created as replacement */
		newAudienceId: text("new_audience_id")
			.notNull()
			.references(() => audiences.id),
		/** Number of users migrated */
		migratedUserCount: integer("migrated_user_count").notNull().default(0),
		/** Rotation status: 'pending' | 'in_progress' | 'completed' | 'failed' */
		status: text("status").notNull().default("pending"),
		/** Error message if rotation failed */
		errorMessage: text("error_message"),
		...timestamps,
	},
	(table) => [
		index("idx_rotation_logs_original").on(table.originalAudienceId),
		index("idx_rotation_logs_status").on(table.status),
	],
);
