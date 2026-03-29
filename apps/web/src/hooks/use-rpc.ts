// =============================================================================
// Cap'n Web RPC Hooks -- TanStack Query integration
// =============================================================================
// These hooks use Cap'n Web's promise pipelining + HTTP batch mode.
// All authentication is handled via httpOnly cookies (credentials: "include").
// Query keys and cache timing are centralised in lib/query-config.ts.

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CACHE_TIMES, queryKeys } from "../lib/query-config";
import { createRpcSession } from "../lib/rpc";

// Singleton RPC session (created once, reused across components)
let rpcSession: ReturnType<typeof createRpcSession> | null = null;

function getRpc() {
	if (!rpcSession) {
		rpcSession = createRpcSession();
	}
	return rpcSession;
}

// ---------------------------------------------------------------------------
// Friends RPC Hooks
// ---------------------------------------------------------------------------

export function useFriendCount() {
	return useSuspenseQuery({
		queryKey: queryKeys.rpc.friends.count(),
		...CACHE_TIMES.MODERATE,
		queryFn: async () => {
			const rpc = getRpc();
			const session = await rpc.authenticate(""); // Cookie-based, token ignored server-side
			return session.friends().count();
		},
	});
}

export function useFriendList(opts: { page: number; limit: number; tagId?: string }) {
	return useSuspenseQuery({
		queryKey: queryKeys.rpc.friends.list(opts),
		...CACHE_TIMES.MODERATE,
		queryFn: async () => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.friends().list(opts);
		},
	});
}

export function useFriend(id: string) {
	return useSuspenseQuery({
		queryKey: queryKeys.rpc.friends.detail(id),
		...CACHE_TIMES.MODERATE,
		queryFn: async () => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.friends().get(id);
		},
	});
}

export function useAssignTag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ friendId, tagId }: { friendId: string; tagId: string }) => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.friends().assignTag(friendId, tagId);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.rpc.friends.all });
		},
	});
}

export function useRemoveTag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ friendId, tagId }: { friendId: string; tagId: string }) => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.friends().removeTag(friendId, tagId);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.rpc.friends.all });
		},
	});
}

// ---------------------------------------------------------------------------
// Scenarios RPC Hooks
// ---------------------------------------------------------------------------

export function useScenarioList(lineAccountId?: string) {
	return useSuspenseQuery({
		queryKey: queryKeys.rpc.scenarios.list(lineAccountId),
		...CACHE_TIMES.MODERATE,
		queryFn: async () => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.scenarios().list(lineAccountId);
		},
	});
}

export function useScenario(id: string) {
	return useSuspenseQuery({
		queryKey: queryKeys.rpc.scenarios.detail(id),
		...CACHE_TIMES.MODERATE,
		queryFn: async () => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.scenarios().get(id);
		},
	});
}

export function useCreateScenario() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (data: {
			name: string;
			description?: string;
			triggerType: string;
			triggerTagId?: string;
			lineAccountId?: string;
		}) => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.scenarios().create(data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.rpc.scenarios.all });
		},
	});
}

export function useToggleScenarioActive() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.scenarios().setActive(id, isActive);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.rpc.scenarios.all });
		},
	});
}

export function useDeleteScenario() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			return session.scenarios().delete(id);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.rpc.scenarios.all });
		},
	});
}

// ---------------------------------------------------------------------------
// Dashboard: Batch RPC (all in one HTTP request via promise pipelining)
// ---------------------------------------------------------------------------

export function useDashboardStats() {
	return useSuspenseQuery({
		queryKey: queryKeys.rpc.dashboard.stats(),
		...CACHE_TIMES.REALTIME,
		queryFn: async () => {
			const rpc = getRpc();
			const session = await rpc.authenticate("");
			const friends = session.friends();
			const scenarios = session.scenarios();

			// Promise pipelining: these all go in a single HTTP batch request
			const [friendCount, scenarioList] = await Promise.all([friends.count(), scenarios.listActive()]);

			return { friendCount, activeScenarios: scenarioList.length };
		},
	});
}
