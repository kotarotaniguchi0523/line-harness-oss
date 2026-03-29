import { z } from "zod";

// =============================================================================
// Domain Enums (SSoT - import these everywhere, no magic strings)
// =============================================================================

// --- Message ---
export const MessageType = z.enum(["text", "image", "flex", "carousel", "video"]);
export type MessageType = z.infer<typeof MessageType>;

export const MessageDirection = z.enum(["incoming", "outgoing"]);
export type MessageDirection = z.infer<typeof MessageDirection>;

export const DeliveryType = z.enum(["push", "reply"]);
export type DeliveryType = z.infer<typeof DeliveryType>;

// --- Scenario ---
export const ScenarioTriggerType = z.enum(["friend_add", "tag_added", "manual"]);
export type ScenarioTriggerType = z.infer<typeof ScenarioTriggerType>;

export const FriendScenarioStatus = z.enum(["active", "paused", "completed"]);
export type FriendScenarioStatus = z.infer<typeof FriendScenarioStatus>;

// --- Broadcast ---
export const BroadcastTargetType = z.enum(["all", "tag"]);
export type BroadcastTargetType = z.infer<typeof BroadcastTargetType>;

export const BroadcastStatus = z.enum(["draft", "scheduled", "sending", "sent"]);
export type BroadcastStatus = z.infer<typeof BroadcastStatus>;

// --- Auto Reply ---
export const AutoReplyMatchType = z.enum(["exact", "contains"]);
export type AutoReplyMatchType = z.infer<typeof AutoReplyMatchType>;

// --- Automation ---
export const AutomationEventType = z.enum([
	"friend_add",
	"tag_change",
	"score_threshold",
	"cv_fire",
	"message_received",
	"calendar_booked",
]);
export type AutomationEventType = z.infer<typeof AutomationEventType>;

export const AutomationActionType = z.enum([
	"add_tag",
	"remove_tag",
	"start_scenario",
	"send_message",
	"send_webhook",
	"switch_rich_menu",
	"remove_rich_menu",
	"set_metadata",
]);
export type AutomationActionType = z.infer<typeof AutomationActionType>;

export const AutomationLogStatus = z.enum(["success", "partial", "failed"]);
export type AutomationLogStatus = z.infer<typeof AutomationLogStatus>;

// --- Chat ---
export const ChatStatus = z.enum(["unread", "in_progress", "resolved"]);
export type ChatStatus = z.infer<typeof ChatStatus>;

export const OperatorRole = z.enum(["admin", "operator"]);
export type OperatorRole = z.infer<typeof OperatorRole>;

// --- Notification ---
export const NotificationStatus = z.enum(["pending", "sent", "failed"]);
export type NotificationStatus = z.infer<typeof NotificationStatus>;

// --- Calendar ---
export const CalendarBookingStatus = z.enum(["confirmed", "cancelled", "completed"]);
export type CalendarBookingStatus = z.infer<typeof CalendarBookingStatus>;

export const CalendarAuthType = z.enum(["oauth", "api_key"]);
export type CalendarAuthType = z.infer<typeof CalendarAuthType>;

// --- Reminder ---
export const FriendReminderStatus = z.enum(["active", "completed", "cancelled"]);
export type FriendReminderStatus = z.infer<typeof FriendReminderStatus>;

// --- Health ---
export const RiskLevel = z.enum(["normal", "warning", "danger"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const MigrationStatus = z.enum(["pending", "in_progress", "completed", "failed"]);
export type MigrationStatus = z.infer<typeof MigrationStatus>;

// --- Staff ---
export const StaffRole = z.enum(["owner", "admin", "staff"]);
export type StaffRole = z.infer<typeof StaffRole>;

// --- Conversion ---
export const ConversionEventType = z.enum([
	"friend_add",
	"rich_menu_tap",
	"url_click",
	"form_submit",
	"keyword_sent",
	"scenario_step",
	"liff_view",
	"purchase",
	"custom",
]);
export type ConversionEventType = z.infer<typeof ConversionEventType>;

// --- Ad Platform ---
export const AdPlatformType = z.enum(["meta", "x", "google", "tiktok", "yahoo_search", "yahoo_display"]);
export type AdPlatformType = z.infer<typeof AdPlatformType>;

export const AdConversionLogStatus = z.enum(["pending", "sent", "failed"]);
export type AdConversionLogStatus = z.infer<typeof AdConversionLogStatus>;

// --- Background Job ---
export const JobType = z.enum(["send_broadcast", "deliver_step", "fire_conversion", "sync_webhook"]);
export type JobType = z.infer<typeof JobType>;

export const JobStatus = z.enum(["pending", "processing", "completed", "failed"]);
export type JobStatus = z.infer<typeof JobStatus>;
