// =============================================================================
// Branded Types using Unique Symbol pattern
// =============================================================================

import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Brand tag using unique symbol for nominal typing */
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

// --- Entity IDs (Branded string types) ---

declare const FriendIdBrand: unique symbol;
export type FriendId = Brand<string, typeof FriendIdBrand>;

declare const TagIdBrand: unique symbol;
export type TagId = Brand<string, typeof TagIdBrand>;

declare const ScenarioIdBrand: unique symbol;
export type ScenarioId = Brand<string, typeof ScenarioIdBrand>;

declare const ScenarioStepIdBrand: unique symbol;
export type ScenarioStepId = Brand<string, typeof ScenarioStepIdBrand>;

declare const BroadcastIdBrand: unique symbol;
export type BroadcastId = Brand<string, typeof BroadcastIdBrand>;

declare const AutomationIdBrand: unique symbol;
export type AutomationId = Brand<string, typeof AutomationIdBrand>;

declare const ChatIdBrand: unique symbol;
export type ChatId = Brand<string, typeof ChatIdBrand>;

declare const OperatorIdBrand: unique symbol;
export type OperatorId = Brand<string, typeof OperatorIdBrand>;

declare const ReminderIdBrand: unique symbol;
export type ReminderId = Brand<string, typeof ReminderIdBrand>;

declare const ScoringRuleIdBrand: unique symbol;
export type ScoringRuleId = Brand<string, typeof ScoringRuleIdBrand>;

declare const TemplateIdBrand: unique symbol;
export type TemplateId = Brand<string, typeof TemplateIdBrand>;

declare const UserIdBrand: unique symbol;
export type UserId = Brand<string, typeof UserIdBrand>;

declare const LineAccountIdBrand: unique symbol;
export type LineAccountId = Brand<string, typeof LineAccountIdBrand>;

declare const StaffIdBrand: unique symbol;
export type StaffId = Brand<string, typeof StaffIdBrand>;

declare const WebhookIdBrand: unique symbol;
export type WebhookId = Brand<string, typeof WebhookIdBrand>;

declare const ConversionPointIdBrand: unique symbol;
export type ConversionPointId = Brand<string, typeof ConversionPointIdBrand>;

declare const AffiliateIdBrand: unique symbol;
export type AffiliateId = Brand<string, typeof AffiliateIdBrand>;

// --- Value Object Brands ---

declare const LineUserIdBrand: unique symbol;
export type LineUserId = Brand<string, typeof LineUserIdBrand>;

declare const ChannelIdBrand: unique symbol;
export type ChannelId = Brand<string, typeof ChannelIdBrand>;

declare const ApiKeyBrand: unique symbol;
export type ApiKey = Brand<string, typeof ApiKeyBrand>;

declare const HexColorBrand: unique symbol;
export type HexColor = Brand<string, typeof HexColorBrand>;

// --- Value Object Brands (non-ID) ---

declare const EmailBrand: unique symbol;
export type Email = Brand<string, typeof EmailBrand>;

declare const UrlBrand: unique symbol;
export type Url = Brand<string, typeof UrlBrand>;

declare const DisplayNameBrand: unique symbol;
export type DisplayName = Brand<string, typeof DisplayNameBrand>;

// --- Validation helpers ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(raw: unknown, label: string): string {
	if (!raw || typeof raw !== "string") throw new Error(`Invalid ${label}: expected non-empty string`);
	if (!UUID_RE.test(raw)) throw new Error(`Invalid ${label}: not a valid UUID (got "${raw}")`);
	return raw;
}

function validateNonEmpty(raw: unknown, label: string): string {
	if (!raw || typeof raw !== "string") throw new Error(`Invalid ${label}: expected non-empty string`);
	return raw;
}

// --- Smart constructors (UUID IDs) ---

export function friendId(raw: string): FriendId {
	return validateUuid(raw, "FriendId") as FriendId;
}
export function tagId(raw: string): TagId {
	return validateUuid(raw, "TagId") as TagId;
}
export function scenarioId(raw: string): ScenarioId {
	return validateUuid(raw, "ScenarioId") as ScenarioId;
}
export function scenarioStepId(raw: string): ScenarioStepId {
	return validateUuid(raw, "ScenarioStepId") as ScenarioStepId;
}
export function broadcastId(raw: string): BroadcastId {
	return validateUuid(raw, "BroadcastId") as BroadcastId;
}
export function automationId(raw: string): AutomationId {
	return validateUuid(raw, "AutomationId") as AutomationId;
}
export function chatId(raw: string): ChatId {
	return validateUuid(raw, "ChatId") as ChatId;
}
export function operatorId(raw: string): OperatorId {
	return validateUuid(raw, "OperatorId") as OperatorId;
}
export function reminderId(raw: string): ReminderId {
	return validateUuid(raw, "ReminderId") as ReminderId;
}
export function scoringRuleId(raw: string): ScoringRuleId {
	return validateUuid(raw, "ScoringRuleId") as ScoringRuleId;
}
export function templateId(raw: string): TemplateId {
	return validateUuid(raw, "TemplateId") as TemplateId;
}
export function userId(raw: string): UserId {
	return validateUuid(raw, "UserId") as UserId;
}
export function lineAccountId(raw: string): LineAccountId {
	return validateUuid(raw, "LineAccountId") as LineAccountId;
}
export function staffId(raw: string): StaffId {
	return validateUuid(raw, "StaffId") as StaffId;
}
export function webhookId(raw: string): WebhookId {
	return validateUuid(raw, "WebhookId") as WebhookId;
}
export function conversionPointId(raw: string): ConversionPointId {
	return validateUuid(raw, "ConversionPointId") as ConversionPointId;
}
export function affiliateId(raw: string): AffiliateId {
	return validateUuid(raw, "AffiliateId") as AffiliateId;
}

// --- Smart constructors (non-UUID branded strings) ---

export function lineUserId(raw: string): LineUserId {
	validateNonEmpty(raw, "LineUserId");
	return raw as LineUserId;
}
export function channelIdOf(raw: string): ChannelId {
	validateNonEmpty(raw, "ChannelId");
	return raw as ChannelId;
}
export function apiKey(raw: string): ApiKey {
	validateNonEmpty(raw, "ApiKey");
	return raw as ApiKey;
}
export function hexColor(raw: string): HexColor {
	if (!HEX_COLOR_PATTERN.test(raw)) throw new Error(`Invalid hex color: ${raw}`);
	return raw as HexColor;
}

// --- Smart constructors (Value Objects) ---

export function email(raw: string): Email {
	validateNonEmpty(raw, "Email");
	if (!EMAIL_PATTERN.test(raw)) throw new Error(`Invalid Email: "${raw}"`);
	return raw as Email;
}
export function url(raw: string): Url {
	validateNonEmpty(raw, "Url");
	try {
		new URL(raw);
	} catch {
		throw new Error(`Invalid Url: "${raw}"`);
	}
	return raw as Url;
}
export function displayName(raw: string): DisplayName {
	if (typeof raw !== "string") throw new Error("Invalid DisplayName: expected string");
	if (raw.length === 0 || raw.length > 200)
		throw new Error(`Invalid DisplayName: length must be 1-200 (got ${raw.length})`);
	return raw as DisplayName;
}

/** Generate a new random ID with proper branding */
export function newId<T extends string>(): Brand<string, T> {
	return crypto.randomUUID() as Brand<string, T>;
}

// =============================================================================
// SafeParse constructors (return neverthrow Result instead of throwing)
// =============================================================================

/** Error message templates for branded-type validation (no hardcoded strings) */
const BrandedValidationErrors = {
	EXPECTED_NON_EMPTY: (label: string) => `Invalid ${label}: expected non-empty string`,
	NOT_VALID_UUID: (label: string, raw: string) => `Invalid ${label}: not a valid UUID (got "${raw}")`,
	INVALID_HEX_COLOR: (raw: string) => `Invalid hex color: ${raw}`,
	EXPECTED_HEX_COLOR: "Invalid HexColor: expected non-empty string",
	EXPECTED_EMAIL: "Invalid Email: expected non-empty string",
	INVALID_EMAIL: (raw: string) => `Invalid Email: "${raw}"`,
	EXPECTED_URL: "Invalid Url: expected non-empty string",
	INVALID_URL: (raw: string) => `Invalid Url: "${raw}"`,
	EXPECTED_DISPLAY_NAME: "Invalid DisplayName: expected string",
	DISPLAY_NAME_LENGTH: (len: number) => `Invalid DisplayName: length must be 1-200 (got ${len})`,
} as const;

function safeValidateUuid<T>(raw: unknown, label: string): Result<T, string> {
	if (!raw || typeof raw !== "string") return err(BrandedValidationErrors.EXPECTED_NON_EMPTY(label));
	if (!UUID_RE.test(raw)) return err(BrandedValidationErrors.NOT_VALID_UUID(label, raw));
	return ok(raw as T);
}

function safeValidateNonEmpty<T>(raw: unknown, label: string): Result<T, string> {
	if (!raw || typeof raw !== "string") return err(BrandedValidationErrors.EXPECTED_NON_EMPTY(label));
	return ok(raw as T);
}

// --- Safe constructors (UUID IDs) ---

export function safeFriendId(raw: unknown): Result<FriendId, string> {
	return safeValidateUuid(raw, "FriendId");
}
export function safeTagId(raw: unknown): Result<TagId, string> {
	return safeValidateUuid(raw, "TagId");
}
export function safeScenarioId(raw: unknown): Result<ScenarioId, string> {
	return safeValidateUuid(raw, "ScenarioId");
}
export function safeScenarioStepId(raw: unknown): Result<ScenarioStepId, string> {
	return safeValidateUuid(raw, "ScenarioStepId");
}
export function safeBroadcastId(raw: unknown): Result<BroadcastId, string> {
	return safeValidateUuid(raw, "BroadcastId");
}
export function safeAutomationId(raw: unknown): Result<AutomationId, string> {
	return safeValidateUuid(raw, "AutomationId");
}
export function safeChatId(raw: unknown): Result<ChatId, string> {
	return safeValidateUuid(raw, "ChatId");
}
export function safeOperatorId(raw: unknown): Result<OperatorId, string> {
	return safeValidateUuid(raw, "OperatorId");
}
export function safeReminderId(raw: unknown): Result<ReminderId, string> {
	return safeValidateUuid(raw, "ReminderId");
}
export function safeScoringRuleId(raw: unknown): Result<ScoringRuleId, string> {
	return safeValidateUuid(raw, "ScoringRuleId");
}
export function safeTemplateId(raw: unknown): Result<TemplateId, string> {
	return safeValidateUuid(raw, "TemplateId");
}
export function safeUserId(raw: unknown): Result<UserId, string> {
	return safeValidateUuid(raw, "UserId");
}
export function safeLineAccountId(raw: unknown): Result<LineAccountId, string> {
	return safeValidateUuid(raw, "LineAccountId");
}
export function safeStaffId(raw: unknown): Result<StaffId, string> {
	return safeValidateUuid(raw, "StaffId");
}
export function safeWebhookId(raw: unknown): Result<WebhookId, string> {
	return safeValidateUuid(raw, "WebhookId");
}
export function safeConversionPointId(raw: unknown): Result<ConversionPointId, string> {
	return safeValidateUuid(raw, "ConversionPointId");
}
export function safeAffiliateId(raw: unknown): Result<AffiliateId, string> {
	return safeValidateUuid(raw, "AffiliateId");
}

// --- Safe constructors (non-UUID branded strings) ---

export function safeLineUserId(raw: unknown): Result<LineUserId, string> {
	return safeValidateNonEmpty(raw, "LineUserId");
}
export function safeChannelId(raw: unknown): Result<ChannelId, string> {
	return safeValidateNonEmpty(raw, "ChannelId");
}
export function safeApiKey(raw: unknown): Result<ApiKey, string> {
	return safeValidateNonEmpty(raw, "ApiKey");
}

export function safeHexColor(raw: unknown): Result<HexColor, string> {
	if (!raw || typeof raw !== "string") return err(BrandedValidationErrors.EXPECTED_HEX_COLOR);
	if (!HEX_COLOR_PATTERN.test(raw)) return err(BrandedValidationErrors.INVALID_HEX_COLOR(raw));
	return ok(raw as HexColor);
}

// --- Safe constructors (Value Objects) ---

export function safeEmail(raw: unknown): Result<Email, string> {
	if (!raw || typeof raw !== "string") return err(BrandedValidationErrors.EXPECTED_EMAIL);
	if (!EMAIL_PATTERN.test(raw)) return err(BrandedValidationErrors.INVALID_EMAIL(raw));
	return ok(raw as Email);
}

export function safeUrl(raw: unknown): Result<Url, string> {
	if (!raw || typeof raw !== "string") return err(BrandedValidationErrors.EXPECTED_URL);
	try {
		new URL(raw);
	} catch {
		return err(BrandedValidationErrors.INVALID_URL(raw));
	}
	return ok(raw as Url);
}

export function safeDisplayName(raw: unknown): Result<DisplayName, string> {
	if (typeof raw !== "string") return err(BrandedValidationErrors.EXPECTED_DISPLAY_NAME);
	if (raw.length === 0 || raw.length > 200) return err(BrandedValidationErrors.DISPLAY_NAME_LENGTH(raw.length));
	return ok(raw as DisplayName);
}
