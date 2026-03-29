// =============================================================================
// TanStack Query Cache Strategy + Query Options Factory
// =============================================================================
// Centralised cache configuration per domain bounded context.
// All timing constants live here -- no hardcoded staleTime/gcTime elsewhere.
// Uses TanStack Query's queryOptions() helper to bundle queryKey + queryFn + cache timing.
// Ref: https://tanstack.com/query/latest/docs/framework/react/guides/caching

import { queryOptions } from "@tanstack/react-query";
import { fetchApi } from "./rpc";

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
// Query Options Factory — bundles queryKey + queryFn + cache timing
// ---------------------------------------------------------------------------
// Uses TanStack Query's queryOptions() helper so that loaders and components
// share the exact same queryKey+queryFn. No duplication.

const PAGE_SIZE = 20;

export const friendsQueryOptions = {
	list: (params: { page: number; tagId?: string }) => {
		const searchParams = new URLSearchParams({
			limit: String(PAGE_SIZE),
			offset: String((params.page - 1) * PAGE_SIZE),
		});
		if (params.tagId) searchParams.set("tagId", params.tagId);
		return queryOptions({
			queryKey: queryKeys.friends.list(params),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: { items: Record<string, unknown>[]; total: number; page: number; hasNextPage: boolean };
				}>(`/api/friends?${searchParams}`),
			...CACHE_TIMES.MODERATE,
		});
	},
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.friends.detail(id),
			queryFn: () => fetchApi<{ success: true; data: unknown }>(`/api/friends/${id}`),
			...CACHE_TIMES.MODERATE,
		}),
	count: () =>
		queryOptions({
			queryKey: queryKeys.friends.count(),
			queryFn: () => fetchApi<{ success: true; data: { count: number } }>("/api/friends/count"),
			...CACHE_TIMES.MODERATE,
		}),
};

export const tagsQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.tags.list(),
			queryFn: () =>
				fetchApi<{ success: true; data: Array<{ id: string; name: string; color: string; createdAt: string }> }>(
					"/api/tags",
				),
			...CACHE_TIMES.STATIC,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.tags.detail(id),
			queryFn: () => fetchApi<{ success: true; data: { id: string; name: string; color: string } }>(`/api/tags/${id}`),
			...CACHE_TIMES.STATIC,
		}),
};

export const scenariosQueryOptions = {
	list: (lineAccountId?: string) =>
		queryOptions({
			queryKey: queryKeys.scenarios.list(lineAccountId),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						description: string | null;
						triggerType: string;
						isActive: boolean;
						stepCount?: number;
						createdAt: string;
					}>;
				}>(`/api/scenarios${lineAccountId ? `?lineAccountId=${lineAccountId}` : ""}`),
			...CACHE_TIMES.MODERATE,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.scenarios.detail(id),
			queryFn: () => fetchApi<{ success: true; data: unknown }>(`/api/scenarios/${id}`),
			...CACHE_TIMES.MODERATE,
		}),
};

export const broadcastsQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.broadcasts.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						title: string;
						messageType: string;
						messageContent: string;
						targetType: string;
						targetTagId: string | null;
						status: string;
						scheduledAt: string | null;
						sentAt: string | null;
						totalCount: number;
						successCount: number;
						createdAt: string;
					}>;
				}>("/api/broadcasts"),
			...CACHE_TIMES.MODERATE,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.broadcasts.detail(id),
			queryFn: () => fetchApi<{ success: true; data: unknown }>(`/api/broadcasts/${id}`),
			...CACHE_TIMES.MODERATE,
		}),
};

export const chatsQueryOptions = {
	list: (params?: { status?: string }) => {
		const statusParam = params?.status;
		return queryOptions({
			queryKey: queryKeys.chats.list(params),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						friendId: string;
						friendName: string | null;
						status: string;
						lastMessageAt: string | null;
					}>;
				}>(`/api/chats${statusParam ? `?status=${statusParam}` : ""}`),
			...CACHE_TIMES.REALTIME,
		});
	},
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.chats.detail(id),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: {
						id: string;
						friendId: string;
						friendName: string | null;
						status: string;
						lastMessageAt: string | null;
						messages: Array<{ id: string; direction: string; messageType: string; content: string; createdAt: string }>;
					};
				}>(`/api/chats/${id}`),
			...CACHE_TIMES.REALTIME,
		}),
};

export const groupChatsQueryOptions = {
	list: (params?: { status?: string }) => {
		const statusParam = params?.status;
		return queryOptions({
			queryKey: queryKeys.groupChats.list(params),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						groupId: string;
						groupName: string;
						groupPictureUrl: string | null;
						memberCount: number;
						lastMessageAt: string | null;
						status: string;
						sourceType: "group" | "room";
					}>;
				}>(`/api/chats/groups${statusParam ? `?status=${statusParam}` : ""}`),
			...CACHE_TIMES.REALTIME,
		});
	},
	detail: (groupId: string) =>
		queryOptions({
			queryKey: queryKeys.groupChats.detail(groupId),
			queryFn: () => fetchApi<{ success: true; data: unknown }>(`/api/chats/groups/${groupId}`),
			...CACHE_TIMES.REALTIME,
		}),
	messages: (groupId: string) =>
		queryOptions({
			queryKey: queryKeys.groupChats.messages(groupId),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						senderName: string | null;
						senderPictureUrl: string | null;
						direction: string;
						messageType: string;
						content: string;
						createdAt: string;
					}>;
				}>(`/api/chats/groups/${groupId}/messages`),
			...CACHE_TIMES.REALTIME,
		}),
};

export const templatesQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.templates.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						category: string;
						messageType: string;
						messageContent: string;
						createdAt: string;
						updatedAt: string;
					}>;
				}>("/api/templates"),
			...CACHE_TIMES.STATIC,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.templates.detail(id),
			queryFn: () => fetchApi<{ success: true; data: unknown }>(`/api/templates/${id}`),
			...CACHE_TIMES.STATIC,
		}),
};

export const automationsQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.automations.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						description: string | null;
						eventType: string;
						actions: unknown[];
						conditions: Record<string, unknown>;
						priority: number;
						isActive: boolean;
						createdAt: string;
					}>;
				}>("/api/automations"),
			...CACHE_TIMES.MODERATE,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.automations.detail(id),
			queryFn: () => fetchApi<{ success: true; data: unknown }>(`/api/automations/${id}`),
			...CACHE_TIMES.MODERATE,
		}),
};

export const scoringRulesQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.scoringRules.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						eventType: string;
						scoreValue: number;
						isActive: boolean;
						createdAt: string;
					}>;
				}>("/api/scoring-rules"),
			...CACHE_TIMES.STATIC,
		}),
};

export const remindersQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.reminders.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{ id: string; name: string; description: string | null; isActive: boolean; createdAt: string }>;
				}>("/api/reminders"),
			...CACHE_TIMES.MODERATE,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: queryKeys.reminders.detail(id),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: {
						id: string;
						name: string;
						description: string | null;
						isActive: boolean;
						steps: Array<{ id: string; offsetMinutes: number; messageType: string; messageContent: string }>;
						createdAt: string;
					};
				}>(`/api/reminders/${id}`),
			...CACHE_TIMES.MODERATE,
		}),
};

export const conversionsQueryOptions = {
	points: () =>
		queryOptions({
			queryKey: queryKeys.conversions.points(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{ id: string; name: string; eventType: string; value: number | null; createdAt: string }>;
				}>("/api/conversions/points"),
			...CACHE_TIMES.MODERATE,
		}),
	report: () =>
		queryOptions({
			queryKey: queryKeys.conversions.report(),
			queryFn: () =>
				fetchApi<{ success: true; data: Array<{ name: string; count: number; totalValue: number }> }>(
					"/api/conversions/report",
				),
			...CACHE_TIMES.MODERATE,
		}),
};

export const webhooksQueryOptions = {
	incoming: () =>
		queryOptions({
			queryKey: queryKeys.webhooks.incoming(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{ id: string; name: string; sourceType: string; isActive: boolean; createdAt: string }>;
				}>("/api/webhooks/incoming"),
			...CACHE_TIMES.CONFIG,
		}),
	outgoing: () =>
		queryOptions({
			queryKey: queryKeys.webhooks.outgoing(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						url: string;
						eventTypes: string[];
						secret: string;
						isActive: boolean;
						createdAt: string;
					}>;
				}>("/api/webhooks/outgoing"),
			...CACHE_TIMES.CONFIG,
		}),
};

export const lineAccountsQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.lineAccounts.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						channelId: string;
						isActive: boolean;
						channelAccessToken: string;
						channelSecret: string;
						createdAt: string;
					}>;
				}>("/api/line-accounts"),
			...CACHE_TIMES.CONFIG,
		}),
};

export const staffQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: queryKeys.staff.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						email: string | null;
						role: string;
						apiKey: string;
						isActive: boolean;
						createdAt: string;
					}>;
				}>("/api/staff"),
			...CACHE_TIMES.STATIC,
		}),
};

export const notificationsQueryOptions = {
	list: (params?: { status?: string }) => {
		const statusParam = params?.status;
		return queryOptions({
			queryKey: queryKeys.notifications.list(params),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						title: string;
						eventType: string;
						channel: string;
						status: string;
						createdAt: string;
					}>;
				}>(`/api/notifications${statusParam ? `?status=${statusParam}` : ""}`),
			...CACHE_TIMES.MODERATE,
		});
	},
	rules: () =>
		queryOptions({
			queryKey: queryKeys.notifications.rules(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						eventType: string;
						channels: string[];
						isActive: boolean;
						createdAt: string;
					}>;
				}>("/api/notifications/rules"),
			...CACHE_TIMES.STATIC,
		}),
};

export const affiliatesQueryOptions = {
	refStats: () =>
		queryOptions({
			queryKey: queryKeys.affiliates.refStats(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: {
						totalFriends: number;
						friendsWithRef: number;
						friendsWithoutRef: number;
						routes: Array<{ refCode: string; routeName: string | null; friendCount: number; clickCount: number }>;
					};
				}>("/api/friends/ref-stats"),
			...CACHE_TIMES.MODERATE,
		}),
};

export const healthQueryOptions = {
	lineAccounts: () =>
		queryOptions({
			queryKey: queryKeys.lineAccounts.list(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						name: string;
						channelId: string;
						riskLevel: string;
						isActive: boolean;
						createdAt: string;
					}>;
				}>("/api/line-accounts"),
			...CACHE_TIMES.CONFIG,
		}),
	migrations: () =>
		queryOptions({
			queryKey: queryKeys.health.migrations(),
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						fromAccountId: string;
						toAccountId: string;
						status: string;
						migratedCount: number;
						totalCount: number;
					}>;
				}>("/api/accounts/migrations"),
			...CACHE_TIMES.MODERATE,
		}),
};

export const autoRepliesQueryOptions = {
	list: () =>
		queryOptions({
			queryKey: ["auto-replies"] as const,
			queryFn: () =>
				fetchApi<{
					success: true;
					data: Array<{
						id: string;
						keyword: string;
						matchType: string;
						isActive: boolean;
						priority: number;
						lineAccountId: string | null;
						createdAt: string;
						messages: Array<{
							id: string;
							autoReplyId: string;
							messageOrder: number;
							messageType: string;
							messageContent: string;
						}>;
					}>;
				}>("/api/auto-replies"),
			...CACHE_TIMES.MODERATE,
		}),
};

// ---------------------------------------------------------------------------
// Legacy queryOptionsConfig — kept for backward compatibility during migration
// TODO: Remove once all consumers are migrated to domain-specific queryOptions
// ---------------------------------------------------------------------------

export const queryOptionsConfig = {
	friends: {
		list: (params: { page: number; tagId?: string }) => friendsQueryOptions.list(params),
		detail: (id: string) => friendsQueryOptions.detail(id),
		count: () => friendsQueryOptions.count(),
	},
	scenarios: {
		list: (lineAccountId?: string) => scenariosQueryOptions.list(lineAccountId),
		detail: (id: string) => scenariosQueryOptions.detail(id),
	},
	broadcasts: {
		list: () => broadcastsQueryOptions.list(),
		detail: (id: string) => broadcastsQueryOptions.detail(id),
	},
	tags: {
		list: () => tagsQueryOptions.list(),
		detail: (id: string) => tagsQueryOptions.detail(id),
	},
	chats: {
		list: (params?: { status?: string }) => chatsQueryOptions.list(params),
		detail: (id: string) => chatsQueryOptions.detail(id),
	},
	groupChats: {
		list: (params?: { status?: string }) => groupChatsQueryOptions.list(params),
		detail: (groupId: string) => groupChatsQueryOptions.detail(groupId),
		messages: (groupId: string) => groupChatsQueryOptions.messages(groupId),
	},
	templates: {
		list: () => templatesQueryOptions.list(),
		detail: (id: string) => templatesQueryOptions.detail(id),
	},
	automations: {
		list: () => automationsQueryOptions.list(),
		detail: (id: string) => automationsQueryOptions.detail(id),
	},
	scoringRules: {
		list: () => scoringRulesQueryOptions.list(),
	},
	reminders: {
		list: () => remindersQueryOptions.list(),
		detail: (id: string) => remindersQueryOptions.detail(id),
	},
	conversions: {
		points: () => conversionsQueryOptions.points(),
		report: () => conversionsQueryOptions.report(),
	},
	webhooks: {
		incoming: () => webhooksQueryOptions.incoming(),
		outgoing: () => webhooksQueryOptions.outgoing(),
	},
	lineAccounts: {
		list: () => lineAccountsQueryOptions.list(),
	},
	staff: {
		list: () => staffQueryOptions.list(),
	},
	notifications: {
		list: (params?: { status?: string }) => notificationsQueryOptions.list(params),
		rules: () => notificationsQueryOptions.rules(),
	},
	affiliates: {
		refStats: () => affiliatesQueryOptions.refStats(),
	},
	dashboard: {
		stats: () =>
			queryOptions({
				queryKey: queryKeys.dashboard.stats(),
				queryFn: () => fetchApi<{ success: true; data: unknown }>("/api/dashboard/stats"),
				...CACHE_TIMES.REALTIME,
			}),
	},
};
