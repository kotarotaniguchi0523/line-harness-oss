// =============================================================================
// TanStack Query Cache Strategy + Query Key Factory
// =============================================================================
// Centralised cache configuration per domain bounded context.
// All timing constants live here -- no hardcoded staleTime/gcTime elsewhere.
// Ref: https://tanstack.com/query/latest/docs/framework/react/guides/caching

// ---------------------------------------------------------------------------
// Cache Timing Constants
// ---------------------------------------------------------------------------

/** Cache timing presets grouped by data volatility */
export const CACHE_TIMES = {
	/**
	 * Infrequently changing reference data (tags, templates, staff, scoring rules).
	 * 5 min stale, 30 min GC.
	 */
	STATIC: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },

	/**
	 * Moderately updated operational data (friends list, scenarios, broadcasts,
	 * reminders, automations, conversions, notifications).
	 * 30 sec stale, 5 min GC.
	 */
	MODERATE: { staleTime: 30_000, gcTime: 5 * 60_000 },

	/**
	 * Real-time or near-real-time data (chats, dashboard stats).
	 * 5 sec stale, 60 sec GC.
	 */
	REALTIME: { staleTime: 5_000, gcTime: 60_000 },

	/**
	 * Rarely changing configuration (LINE accounts, webhook settings).
	 * 10 min stale, 60 min GC.
	 */
	CONFIG: { staleTime: 10 * 60_000, gcTime: 60 * 60_000 },
} as const;

/** Type for any cache timing preset */
export type CachePreset = (typeof CACHE_TIMES)[keyof typeof CACHE_TIMES];

// ---------------------------------------------------------------------------
// Default QueryClient Options (import in __root.tsx)
// ---------------------------------------------------------------------------

export const DEFAULT_QUERY_OPTIONS = {
	queries: {
		...CACHE_TIMES.MODERATE,
		retry: 1,
		refetchOnWindowFocus: false,
	},
} as const;

// ---------------------------------------------------------------------------
// Query Key Factory — type-safe, collision-free, hierarchical
// ---------------------------------------------------------------------------
// Pattern: each domain exposes `all` (broad invalidation), plus granular keys.

export const queryKeys = {
	// -- CRM: Friends --------------------------------------------------------
	friends: {
		all: ["friends"] as const,
		list: (params: { page: number; tagId?: string }) => ["friends", "list", params] as const,
		detail: (id: string) => ["friends", "detail", id] as const,
		count: () => ["friends", "count"] as const,
	},

	// -- CRM: Scenarios ------------------------------------------------------
	scenarios: {
		all: ["scenarios"] as const,
		list: (lineAccountId?: string) => ["scenarios", "list", lineAccountId] as const,
		detail: (id: string) => ["scenarios", "detail", id] as const,
	},

	// -- Marketing: Broadcasts -----------------------------------------------
	broadcasts: {
		all: ["broadcasts"] as const,
		list: () => ["broadcasts", "list"] as const,
		detail: (id: string) => ["broadcasts", "detail", id] as const,
	},

	// -- CRM: Tags -----------------------------------------------------------
	tags: {
		all: ["tags"] as const,
		list: () => ["tags", "list"] as const,
		detail: (id: string) => ["tags", "detail", id] as const,
	},

	// -- Engagement: Chats ---------------------------------------------------
	chats: {
		all: ["chats"] as const,
		list: (params?: { status?: string }) => ["chats", "list", params] as const,
		detail: (id: string) => ["chats", "detail", id] as const,
	},

	// -- Engagement: Group Chats ---------------------------------------------
	groupChats: {
		all: ["group-chats"] as const,
		list: (params?: { status?: string }) => ["group-chats", "list", params] as const,
		detail: (groupId: string) => ["group-chats", "detail", groupId] as const,
		messages: (groupId: string) => ["group-chats", "messages", groupId] as const,
	},

	// -- Marketing: Templates ------------------------------------------------
	templates: {
		all: ["templates"] as const,
		list: () => ["templates", "list"] as const,
		detail: (id: string) => ["templates", "detail", id] as const,
	},

	// -- Automation: Automations ---------------------------------------------
	automations: {
		all: ["automations"] as const,
		list: () => ["automations", "list"] as const,
		detail: (id: string) => ["automations", "detail", id] as const,
	},

	// -- Engagement: Scoring -------------------------------------------------
	scoringRules: {
		all: ["scoring-rules"] as const,
		list: () => ["scoring-rules", "list"] as const,
		detail: (id: string) => ["scoring-rules", "detail", id] as const,
	},

	// -- Engagement: Reminders -----------------------------------------------
	reminders: {
		all: ["reminders"] as const,
		list: () => ["reminders", "list"] as const,
		detail: (id: string) => ["reminders", "detail", id] as const,
	},

	// -- Integration: Conversions --------------------------------------------
	conversions: {
		all: ["conversions"] as const,
		points: () => ["conversions", "points"] as const,
		report: () => ["conversions", "report"] as const,
	},

	// -- Integration: Webhooks -----------------------------------------------
	webhooks: {
		all: ["webhooks"] as const,
		incoming: () => ["webhooks", "incoming"] as const,
		outgoing: () => ["webhooks", "outgoing"] as const,
	},

	// -- Admin: LINE Accounts ------------------------------------------------
	lineAccounts: {
		all: ["line-accounts"] as const,
		list: () => ["line-accounts", "list"] as const,
		detail: (id: string) => ["line-accounts", "detail", id] as const,
	},

	// -- Admin: Staff --------------------------------------------------------
	staff: {
		all: ["staff"] as const,
		list: () => ["staff", "list"] as const,
		detail: (id: string) => ["staff", "detail", id] as const,
	},

	// -- Admin: Notifications ------------------------------------------------
	notifications: {
		all: ["notifications"] as const,
		list: (params?: { status?: string }) => ["notifications", "list", params] as const,
		rules: () => ["notifications", "rules"] as const,
	},

	// -- Integration: Affiliates ---------------------------------------------
	affiliates: {
		all: ["affiliates"] as const,
		refStats: () => ["affiliates", "ref-stats"] as const,
	},

	// -- Admin: Account Health / Migrations ----------------------------------
	health: {
		all: ["health"] as const,
		migrations: () => ["health", "migrations"] as const,
	},

	// -- Dashboard (aggregated, real-time) -----------------------------------
	dashboard: {
		all: ["dashboard"] as const,
		stats: () => ["dashboard", "stats"] as const,
	},

	// -- RPC variants (Cap'n Web) -------------------------------------------
	rpc: {
		friends: {
			all: ["rpc", "friends"] as const,
			list: (opts: { page: number; limit: number; tagId?: string }) => ["rpc", "friends", "list", opts] as const,
			detail: (id: string) => ["rpc", "friends", "detail", id] as const,
			count: () => ["rpc", "friends", "count"] as const,
		},
		scenarios: {
			all: ["rpc", "scenarios"] as const,
			list: (lineAccountId?: string) => ["rpc", "scenarios", "list", lineAccountId] as const,
			detail: (id: string) => ["rpc", "scenarios", "detail", id] as const,
		},
		dashboard: {
			stats: () => ["rpc", "dashboard", "stats"] as const,
		},
	},
} as const;

// ---------------------------------------------------------------------------
// Query Options Factory — combines keys + cache presets per domain
// ---------------------------------------------------------------------------

export const queryOptionsConfig = {
	friends: {
		list: (params: { page: number; tagId?: string }) => ({
			queryKey: queryKeys.friends.list(params),
			...CACHE_TIMES.MODERATE,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.friends.detail(id),
			...CACHE_TIMES.MODERATE,
		}),
		count: () => ({
			queryKey: queryKeys.friends.count(),
			...CACHE_TIMES.MODERATE,
		}),
	},

	scenarios: {
		list: (lineAccountId?: string) => ({
			queryKey: queryKeys.scenarios.list(lineAccountId),
			...CACHE_TIMES.MODERATE,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.scenarios.detail(id),
			...CACHE_TIMES.MODERATE,
		}),
	},

	broadcasts: {
		list: () => ({
			queryKey: queryKeys.broadcasts.list(),
			...CACHE_TIMES.MODERATE,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.broadcasts.detail(id),
			...CACHE_TIMES.MODERATE,
		}),
	},

	tags: {
		list: () => ({
			queryKey: queryKeys.tags.list(),
			...CACHE_TIMES.STATIC,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.tags.detail(id),
			...CACHE_TIMES.STATIC,
		}),
	},

	chats: {
		list: (params?: { status?: string }) => ({
			queryKey: queryKeys.chats.list(params),
			...CACHE_TIMES.REALTIME,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.chats.detail(id),
			...CACHE_TIMES.REALTIME,
		}),
	},

	groupChats: {
		list: (params?: { status?: string }) => ({
			queryKey: queryKeys.groupChats.list(params),
			...CACHE_TIMES.REALTIME,
		}),
		detail: (groupId: string) => ({
			queryKey: queryKeys.groupChats.detail(groupId),
			...CACHE_TIMES.REALTIME,
		}),
		messages: (groupId: string) => ({
			queryKey: queryKeys.groupChats.messages(groupId),
			...CACHE_TIMES.REALTIME,
		}),
	},

	templates: {
		list: () => ({
			queryKey: queryKeys.templates.list(),
			...CACHE_TIMES.STATIC,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.templates.detail(id),
			...CACHE_TIMES.STATIC,
		}),
	},

	automations: {
		list: () => ({
			queryKey: queryKeys.automations.list(),
			...CACHE_TIMES.MODERATE,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.automations.detail(id),
			...CACHE_TIMES.MODERATE,
		}),
	},

	scoringRules: {
		list: () => ({
			queryKey: queryKeys.scoringRules.list(),
			...CACHE_TIMES.STATIC,
		}),
	},

	reminders: {
		list: () => ({
			queryKey: queryKeys.reminders.list(),
			...CACHE_TIMES.MODERATE,
		}),
		detail: (id: string) => ({
			queryKey: queryKeys.reminders.detail(id),
			...CACHE_TIMES.MODERATE,
		}),
	},

	conversions: {
		points: () => ({
			queryKey: queryKeys.conversions.points(),
			...CACHE_TIMES.MODERATE,
		}),
		report: () => ({
			queryKey: queryKeys.conversions.report(),
			...CACHE_TIMES.MODERATE,
		}),
	},

	webhooks: {
		incoming: () => ({
			queryKey: queryKeys.webhooks.incoming(),
			...CACHE_TIMES.CONFIG,
		}),
		outgoing: () => ({
			queryKey: queryKeys.webhooks.outgoing(),
			...CACHE_TIMES.CONFIG,
		}),
	},

	lineAccounts: {
		list: () => ({
			queryKey: queryKeys.lineAccounts.list(),
			...CACHE_TIMES.CONFIG,
		}),
	},

	staff: {
		list: () => ({
			queryKey: queryKeys.staff.list(),
			...CACHE_TIMES.STATIC,
		}),
	},

	notifications: {
		list: (params?: { status?: string }) => ({
			queryKey: queryKeys.notifications.list(params),
			...CACHE_TIMES.MODERATE,
		}),
		rules: () => ({
			queryKey: queryKeys.notifications.rules(),
			...CACHE_TIMES.STATIC,
		}),
	},

	affiliates: {
		refStats: () => ({
			queryKey: queryKeys.affiliates.refStats(),
			...CACHE_TIMES.MODERATE,
		}),
	},

	dashboard: {
		stats: () => ({
			queryKey: queryKeys.dashboard.stats(),
			...CACHE_TIMES.REALTIME,
		}),
	},
} as const;
