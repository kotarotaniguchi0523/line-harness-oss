import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, id, jsonText, timestamps } from "./_common.js";
import { lineAccounts } from "./admin.js";
import { friends } from "./crm.js";

// =============================================================================
// Forms — Survey / questionnaire system
// =============================================================================

export const forms = sqliteTable("forms", {
	id: id(),
	name: text("name").notNull(),
	description: text("description"),
	fields: text("fields").notNull(), // JSON string of FormField[]
	onSubmitTagId: text("on_submit_tag_id"),
	onSubmitScenarioId: text("on_submit_scenario_id"),
	saveToMetadata: boolean("save_to_metadata").notNull().default(true),
	isActive: boolean("is_active").notNull().default(true),
	submitCount: integer("submit_count").notNull().default(0),
	...timestamps,
});

export const formSubmissions = sqliteTable(
	"form_submissions",
	{
		id: id(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id),
		friendId: text("friend_id").references(() => friends.id),
		data: text("data").notNull(), // JSON string
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_form_submissions_form").on(table.formId),
		index("idx_form_submissions_friend").on(table.friendId),
	],
);

// Webhooks
export const incomingWebhooks = sqliteTable("incoming_webhooks", {
	id: id(),
	name: text("name").notNull(),
	sourceType: text("source_type").notNull().default("custom"),
	secret: text("secret"),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

export const outgoingWebhooks = sqliteTable("outgoing_webhooks", {
	id: id(),
	name: text("name").notNull(),
	url: text("url").notNull(),
	eventTypes: text("event_types").notNull().default("[]"),
	secret: text("secret"),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

// Google Calendar
export const googleCalendarConnections = sqliteTable("google_calendar_connections", {
	id: id(),
	calendarId: text("calendar_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: text("token_expires_at"),
	apiKey: text("api_key"),
	authType: text("auth_type").notNull().default("api_key"),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

export const calendarBookings = sqliteTable(
	"calendar_bookings",
	{
		id: id(),
		connectionId: text("connection_id")
			.notNull()
			.references(() => googleCalendarConnections.id),
		friendId: text("friend_id").references(() => friends.id),
		eventId: text("event_id"),
		title: text("title").notNull(),
		startAt: text("start_at").notNull(),
		endAt: text("end_at").notNull(),
		status: text("status").notNull().default("confirmed"),
		metadata: text("metadata"),
		...timestamps,
	},
	(table) => [
		index("idx_calendar_bookings_friend").on(table.friendId),
		index("idx_calendar_bookings_start").on(table.startAt),
	],
);

// Stripe
export const stripeEvents = sqliteTable(
	"stripe_events",
	{
		id: id(),
		stripeEventId: text("stripe_event_id").unique().notNull(),
		eventType: text("event_type").notNull(),
		friendId: text("friend_id").references(() => friends.id),
		amount: integer("amount"),
		currency: text("currency"),
		metadata: text("metadata"),
		processedAt: text("processed_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_stripe_events_friend").on(table.friendId),
		index("idx_stripe_events_type").on(table.eventType),
	],
);

// Conversion
export const conversionPoints = sqliteTable("conversion_points", {
	id: id(),
	name: text("name").notNull(),
	eventType: text("event_type").notNull(),
	value: integer("value"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const conversionEvents = sqliteTable(
	"conversion_events",
	{
		id: id(),
		conversionPointId: text("conversion_point_id")
			.notNull()
			.references(() => conversionPoints.id),
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		userId: text("user_id"),
		affiliateCode: text("affiliate_code"),
		metadata: text("metadata"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_conversion_events_point").on(table.conversionPointId),
		index("idx_conversion_events_friend").on(table.friendId),
		index("idx_conversion_events_affiliate").on(table.affiliateCode),
	],
);

// Affiliates
export const affiliates = sqliteTable("affiliates", {
	id: id(),
	name: text("name").notNull(),
	code: text("code").unique().notNull(),
	commissionRate: integer("commission_rate").notNull().default(0),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const affiliateClicks = sqliteTable(
	"affiliate_clicks",
	{
		id: id(),
		affiliateId: text("affiliate_id")
			.notNull()
			.references(() => affiliates.id),
		url: text("url"),
		ipAddress: text("ip_address"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [index("idx_affiliate_clicks_affiliate").on(table.affiliateId)],
);

// Ad Platforms
export const adPlatforms = sqliteTable("ad_platforms", {
	id: id(),
	name: text("name").notNull(),
	displayName: text("display_name"),
	config: jsonText("config"),
	isActive: boolean("is_active").default(true),
	...timestamps,
});

export const adConversionLogs = sqliteTable(
	"ad_conversion_logs",
	{
		id: id(),
		adPlatformId: text("ad_platform_id")
			.notNull()
			.references(() => adPlatforms.id),
		friendId: text("friend_id")
			.notNull()
			.references(() => friends.id),
		conversionPointId: text("conversion_point_id").references(() => conversionPoints.id),
		eventName: text("event_name").notNull(),
		clickId: text("click_id"),
		clickIdType: text("click_id_type"),
		status: text("status").default("pending"),
		requestBody: text("request_body"),
		responseBody: text("response_body"),
		errorMessage: text("error_message"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_ad_conversion_logs_platform").on(table.adPlatformId),
		index("idx_ad_conversion_logs_friend").on(table.friendId),
		index("idx_ad_conversion_logs_status").on(table.status),
	],
);

// Templates
export const templates = sqliteTable(
	"templates",
	{
		id: id(),
		name: text("name").notNull(),
		category: text("category").notNull().default("general"),
		messageType: text("message_type").notNull(),
		messageContent: text("message_content").notNull(),
		...timestamps,
	},
	(table) => [index("idx_templates_category").on(table.category)],
);

// Notifications
export const notificationRules = sqliteTable("notification_rules", {
	id: id(),
	name: text("name").notNull(),
	eventType: text("event_type").notNull(),
	conditions: jsonText("conditions"),
	channels: jsonText("channels", '["webhook"]'),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

export const notifications = sqliteTable(
	"notifications",
	{
		id: id(),
		ruleId: text("rule_id").references(() => notificationRules.id),
		eventType: text("event_type").notNull(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		channel: text("channel").notNull(),
		status: text("status").notNull().default("pending"),
		metadata: text("metadata"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_notifications_status").on(table.status),
		index("idx_notifications_created").on(table.createdAt),
	],
);

// Health
export const accountHealthLogs = sqliteTable(
	"account_health_logs",
	{
		id: id(),
		lineAccountId: text("line_account_id")
			.notNull()
			.references(() => lineAccounts.id),
		errorCode: integer("error_code"),
		errorCount: integer("error_count").notNull().default(0),
		checkPeriod: text("check_period").notNull(),
		riskLevel: text("risk_level").notNull().default("normal"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [index("idx_health_logs_account").on(table.lineAccountId)],
);

export const accountMigrations = sqliteTable("account_migrations", {
	id: id(),
	fromAccountId: text("from_account_id")
		.notNull()
		.references(() => lineAccounts.id),
	toAccountId: text("to_account_id")
		.notNull()
		.references(() => lineAccounts.id),
	status: text("status").notNull().default("pending"),
	migratedCount: integer("migrated_count").notNull().default(0),
	totalCount: integer("total_count").notNull().default(0),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	completedAt: text("completed_at"),
});

// Tracked Links
export const trackedLinks = sqliteTable("tracked_links", {
	id: id(),
	name: text("name").notNull(),
	originalUrl: text("original_url").notNull(),
	tagId: text("tag_id"),
	scenarioId: text("scenario_id"),
	isActive: boolean("is_active").notNull().default(true),
	clickCount: integer("click_count").notNull().default(0),
	...timestamps,
});

export const linkClicks = sqliteTable(
	"link_clicks",
	{
		id: id(),
		trackedLinkId: text("tracked_link_id")
			.notNull()
			.references(() => trackedLinks.id),
		friendId: text("friend_id").references(() => friends.id),
		clickedAt: text("clicked_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [index("idx_link_clicks_tracked_link").on(table.trackedLinkId)],
);

// Entry Routes
export const entryRoutes = sqliteTable("entry_routes", {
	id: id(),
	refCode: text("ref_code").unique().notNull(),
	name: text("name").notNull(),
	tagId: text("tag_id"),
	scenarioId: text("scenario_id"),
	redirectUrl: text("redirect_url"),
	isActive: boolean("is_active").notNull().default(true),
	...timestamps,
});

export const refTracking = sqliteTable(
	"ref_tracking",
	{
		id: id(),
		refCode: text("ref_code").notNull(),
		friendId: text("friend_id").references(() => friends.id),
		entryRouteId: text("entry_route_id").references(() => entryRoutes.id),
		sourceUrl: text("source_url"),
		fbclid: text("fbclid"),
		gclid: text("gclid"),
		twclid: text("twclid"),
		ttclid: text("ttclid"),
		yclid: text("yclid"),
		utmSource: text("utm_source"),
		utmMedium: text("utm_medium"),
		utmCampaign: text("utm_campaign"),
		userAgent: text("user_agent"),
		ipAddress: text("ip_address"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_ref_tracking_ref_code").on(table.refCode),
		index("idx_ref_tracking_friend").on(table.friendId),
	],
);
