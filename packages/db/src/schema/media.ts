// =============================================================================
// Media Assets Schema — Tracks uploaded files stored in Cloudflare R2
// =============================================================================
// Every media upload (rich menu images, message images, LIFF assets, form
// attachments) gets a row here for auditing, querying, and lifecycle management.
// The actual binary data lives in R2; this table stores metadata and the R2 key
// for cross-referencing.
// =============================================================================

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { audit, id, softDelete, timestamps } from "./_common.js";
import { lineAccounts, staffMembers } from "./admin.js";

// ---------------------------------------------------------------------------
// media_assets table
// ---------------------------------------------------------------------------

export const mediaAssets = sqliteTable(
	"media_assets",
	{
		/** UUIDv4 primary key */
		id: id(),

		/** R2 object key (e.g. "rich_menu/abc-123-menu.png") — unique across bucket */
		r2Key: text("r2_key").notNull(),

		/** Original filename (sanitised at upload time) */
		filename: text("filename").notNull(),

		/** MIME content type (image/png, image/jpeg, etc.) */
		contentType: text("content_type").notNull(),

		/** File size in bytes */
		sizeBytes: integer("size_bytes").notNull(),

		/** Purpose categorisation: rich_menu | message_image | liff_asset | form_attachment */
		purpose: text("purpose").notNull(),

		/** Staff ID who uploaded the asset */
		uploadedBy: text("uploaded_by")
			.notNull()
			.references(() => staffMembers.id),

		/** Optional LINE account association (null for global assets) */
		lineAccountId: text("line_account_id").references(() => lineAccounts.id),

		/** Optional reference to the entity using this asset (rich menu ID, message ID, etc.) */
		entityRef: text("entity_ref"),

		/** Public serving URL (denormalised for quick access without rebuilding) */
		serveUrl: text("serve_url").notNull(),

		/** ISO 8601 timestamps */
		...timestamps,

		/** Soft delete support */
		...softDelete,

		/** Audit trail */
		...audit,
	},
	(table) => [
		// Fast lookup by R2 key (the primary cross-reference to the actual object)
		uniqueIndex("idx_media_assets_r2_key").on(table.r2Key),

		// Filter by purpose (e.g. list all rich_menu images)
		index("idx_media_assets_purpose").on(table.purpose),

		// Filter by LINE account (e.g. all assets for a specific account)
		index("idx_media_assets_account").on(table.lineAccountId),

		// Filter by uploader (audit / usage tracking)
		index("idx_media_assets_uploaded_by").on(table.uploadedBy),

		// Filter by entity reference (find the image for a specific rich menu)
		index("idx_media_assets_entity_ref").on(table.entityRef),
	],
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

/** Row type for SELECT queries */
export type MediaAsset = typeof mediaAssets.$inferSelect;

/** Insert type for INSERT queries */
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
