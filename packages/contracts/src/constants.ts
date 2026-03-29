// =============================================================================
// Application Constants — No hardcoded values anywhere else
// =============================================================================
// All magic strings, URLs, limits, and configuration defaults are defined here.
// Import from @line-crm/contracts in every package.

// --- LINE Platform URLs ---
export const LINE_URLS = {
	/** LINE友だち追加URL（Bot Basic IDから生成） */
	friendAdd: (botBasicId: string) => `https://line.me/R/ti/p/${botBasicId}` as const,
	/** LINEトーク画面遷移URL */
	openChat: (botBasicId: string) => `https://line.me/R/oaMessage/${botBasicId}/` as const,
	/** LIFF SDK CDN */
	liffSdk: "https://static.line-scdn.net/liff/edge/2/sdk.js" as const,
	/** LIFF ベースURL */
	liffBase: (liffId: string) => `https://liff.line.me/${liffId}` as const,
	/** LINE Messaging API ベースURL */
	messagingApi: "https://api.line.me/v2/bot" as const,
	/** LINE OAuth ベースURL */
	oauthApi: "https://api.line.me/oauth2/v2.1" as const,
} as const;

// --- API Defaults ---
export const API_DEFAULTS = {
	/** デフォルトページサイズ */
	pageSize: 20,
	/** 最大ページサイズ */
	maxPageSize: 100,
	/** ステップ配信バッチサイズ（Workers OOMを防ぐ） */
	deliveryBatchSize: 500,
	/** マルチキャスト最大宛先数（LINE API制限） */
	multicastMaxRecipients: 500,
	/** ブロードキャスト最大再試行回数 */
	broadcastMaxRetries: 3,
	/** Webhook署名検証アルゴリズム */
	webhookSignatureAlgorithm: "SHA256" as const,
} as const;

// --- Rate Limits ---
export const RATE_LIMITS = {
	/** API リクエスト/分 */
	apiRequestsPerMinute: 1000,
	/** LINE Messaging API リクエスト/秒 */
	lineApiRequestsPerSecond: 10,
	/** Broadcast 送信間隔（ミリ秒） */
	broadcastIntervalMs: 100,
} as const;

// --- Session & Auth ---
export const AUTH_CONSTANTS = {
	/** セッションCookie名 */
	sessionCookieName: "better-auth.session_token" as const,
	/** セッション有効期間（秒） */
	sessionMaxAge: 60 * 60 * 24 * 7, // 7 days
	/** APIキー最小長 */
	apiKeyMinLength: 32,
	/** パスワード最小長 */
	passwordMinLength: 8,
} as const;

// --- HTTP Status Messages ---
export const HTTP_ERRORS = {
	unauthorized: "Unauthorized" as const,
	forbidden: "Forbidden" as const,
	notFound: "Not found" as const,
	validationFailed: "Validation failed" as const,
	internalError: "Internal server error" as const,
	invalidJson: "Invalid JSON body" as const,
	invalidParams: "Invalid path parameter" as const,
	invalidQuery: "Invalid query parameters" as const,
} as const;

// --- Domain Limits ---
export const DOMAIN_LIMITS = {
	/** タグ名最大長 */
	tagNameMaxLength: 50,
	/** シナリオ名最大長 */
	scenarioNameMaxLength: 100,
	/** 表示名最大長 */
	displayNameMaxLength: 200,
	/** メタデータ最大サイズ(bytes) */
	metadataMaxBytes: 10_000,
	/** シナリオステップ最大数 */
	maxScenarioSteps: 50,
	/** リマインダーステップ最大数 */
	maxReminderSteps: 20,
	/** 自動応答最大数/アカウント */
	maxAutoRepliesPerAccount: 100,
	/** 自動応答1ルールあたりの最大メッセージ数（LINE API replyMessage 制限） */
	maxAutoReplyMessages: 5,
} as const;

// --- Cron Schedule ---
export const CRON_INTERVALS = {
	/** ステップ配信チェック間隔（分） */
	stepDeliveryMinutes: 1,
	/** ブロードキャスト送信チェック間隔（分） */
	broadcastCheckMinutes: 1,
	/** アカウントヘルスチェック間隔（時間） */
	healthCheckHours: 1,
	/** リマインダー配信チェック間隔（分） */
	reminderDeliveryMinutes: 5,
} as const;

// --- Background Job Queue ---
export const JOB_QUEUE_CONFIG = {
	/** Default max retry attempts for persistent D1 jobs */
	defaultMaxAttempts: 3,
	/** Base delay for exponential backoff (milliseconds) */
	retryBaseDelayMs: 1_000,
	/** Max delay cap for exponential backoff (milliseconds) */
	retryMaxDelayMs: 300_000,
	/** Batch size for CF Queue consumer */
	queueMaxBatchSize: 10,
	/** KV dedup TTL (seconds) — prevents duplicate enqueues */
	dedupTtlSeconds: 300,
	/** Stale job threshold for cleanup (hours) */
	staleJobThresholdHours: 72,
} as const;

// --- Ad Platform API URLs ---
export const AD_PLATFORM_URLS = {
	meta: {
		conversionsApi: "https://graph.facebook.com/v21.0" as const,
	},
	tiktok: {
		eventsApi: "https://business-api.tiktok.com/open_api/v1.3/event/track" as const,
	},
	yahoo: {
		searchConversions: "https://ads-search.yahooapis.jp/api/v14/ConversionService" as const,
		displayConversions: "https://ads-display.yahooapis.jp/api/v14/ConversionService" as const,
		authToken: "https://biz-oauth.yahoo.co.jp/oauth/v1/token" as const,
	},
	google: {
		adsConversions: "https://googleads.googleapis.com/v18/customers" as const,
	},
	x: {
		conversionsApi: "https://ads-api.x.com/12/measurement/conversions" as const,
	},
} as const;

// --- MCP OAuth 2.1 Configuration ---
export const MCP_OAUTH_CONFIG = {
	/** Server name reported in MCP `initialize` response */
	serverName: "line-harness" as const,
	/** Semantic version reported to MCP clients */
	serverVersion: "0.5.0" as const,
	/** OAuth 2.1 scopes supported by the MCP authorization server */
	scopesSupported: ["read", "write", "admin"] as const,
	/** Dynamic client secret expiry in days (RFC 7591) */
	clientSecretExpiryDays: 30,
	/** OAuth authorization code expiry in seconds */
	authCodeExpirySecs: 600,
	/** Access token expiry in seconds (1 hour) */
	accessTokenExpirySecs: 3600,
	/** Refresh token expiry in seconds (30 days) */
	refreshTokenExpirySecs: 30 * 24 * 3600,
	/** Default scope granted when none is requested */
	defaultScope: "read" as const,
} as const;

/** MCP OAuth scope type inferred from constants */
export type McpOAuthScope = (typeof MCP_OAUTH_CONFIG.scopesSupported)[number];

// --- Media Storage ---
export const MEDIA_CONFIG = {
	/** Allowed MIME types for media uploads */
	allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"] as const,
	/** Maximum upload file size in bytes (10 MB) */
	maxFileSizeBytes: 10 * 1024 * 1024,
	/** Maximum filename length after sanitisation */
	maxFilenameLength: 100,
	/** Cache-Control header for served media (1 year, immutable content-addressed) */
	cacheControlServe: "public, max-age=31536000, immutable" as const,
	/** Valid media purpose values */
	purposes: ["rich_menu", "message_image", "liff_asset", "form_attachment"] as const,
} as const;

/** Media asset purpose type inferred from constants */
export type MediaPurpose = (typeof MEDIA_CONFIG.purposes)[number];

// --- Middleware Limits ---
export const MIDDLEWARE_LIMITS = {
	/** デフォルトJSON bodyサイズ上限 (bytes) */
	defaultBodyMaxBytes: 256 * 1024, // 256KB
	/** メディアアップロードbodyサイズ上限 (bytes) */
	mediaUploadMaxBytes: 11 * 1024 * 1024, // 11MB (10MB file + overhead)
	/** 外部API呼び出しタイムアウト (ms) */
	externalApiTimeoutMs: 15_000, // 15 seconds
	/** メディアアップロードタイムアウト (ms) */
	mediaUploadTimeoutMs: 30_000, // 30 seconds
	/** Stripe webhookタイムアウト (ms) */
	stripeWebhookTimeoutMs: 10_000, // 10 seconds
	/** 静的コンテンツキャッシュ (seconds) */
	staticCacheMaxAge: 3600, // 1 hour
	/** メディアキャッシュ (seconds) */
	mediaCacheMaxAge: 31_536_000, // 1 year (immutable)
} as const;

// --- Public Routes (auth skip list) ---
export const PUBLIC_ROUTES = {
	paths: new Set(["/webhook", "/docs", "/openapi.json", "/api/affiliates/click", "/mcp", "/token", "/revoke"]),
	prefixes: ["/t/", "/r/", "/api/liff/", "/auth/", "/.well-known/"] as const,
	patterns: [
		/^\/api\/webhooks\/incoming\/[^/]+\/receive$/,
		/^\/api\/forms\/[^/]+\/submit$/,
		/^\/api\/forms\/[^/]+$/,
		/^\/api\/integrations\/stripe\/webhook$/,
		/^\/api\/media\/serve\/.+$/,
	] as const,
	/** Cap'n Web RPC はオブジェクトCapability認証を使う */
	rpc: "/rpc" as const,
} as const;
