// =============================================================================
// Optimistic Update Helpers for TanStack Query
// =============================================================================
// Generic patterns for optimistic mutations that immediately update the cache,
// roll back on error, and re-fetch on settlement for consistency.
// Ref: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

import { type QueryKey, type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Context stored during onMutate for rollback on error */
interface OptimisticContext<TData> {
	/** Snapshot of query data before the optimistic update */
	previous: TData | undefined;
}

/** Configuration for useOptimisticMutation */
interface OptimisticMutationConfig<TData, TVariables, TError = Error> {
	/** Server-side mutation function */
	mutationFn: (variables: TVariables) => Promise<TData>;
	/** Query key to optimistically update and invalidate */
	queryKey: QueryKey;
	/** Pure function that computes the next cache state from old data + mutation variables */
	updater: (oldData: TData | undefined, variables: TVariables) => TData;
	/**
	 * Additional query keys to invalidate on settlement.
	 * Useful for cross-domain cache busting (e.g. assigning a tag invalidates both friends and tags).
	 */
	relatedKeys?: QueryKey[];
	/** Optional TanStack Query mutation options to merge */
	options?: Omit<
		UseMutationOptions<TData, TError, TVariables, OptimisticContext<TData>>,
		"mutationFn" | "onMutate" | "onError" | "onSettled"
	>;
}

// ---------------------------------------------------------------------------
// useOptimisticMutation
// ---------------------------------------------------------------------------

/**
 * Generic optimistic mutation hook.
 *
 * 1. Cancels in-flight queries for the target key
 * 2. Snapshots the current cache for rollback
 * 3. Applies the optimistic update via `updater`
 * 4. On error: rolls back to snapshot
 * 5. On settle: invalidates the query (and any relatedKeys) for a refetch
 *
 * @example
 * ```ts
 * const assignTag = useOptimisticMutation({
 *   mutationFn: (vars) => rpc.friends().assignTag(vars.friendId, vars.tagId),
 *   queryKey: queryKeys.friends.all,
 *   updater: (old, vars) => {
 *     if (!old) return old;
 *     return old.map(f => f.id === vars.friendId
 *       ? { ...f, tags: [...f.tags, { id: vars.tagId, name: vars.tagName }] }
 *       : f
 *     );
 *   },
 *   relatedKeys: [queryKeys.tags.all],
 * });
 * ```
 */
export function useOptimisticMutation<TData, TVariables, TError = Error>({
	mutationFn,
	queryKey,
	updater,
	relatedKeys = [],
	options = {},
}: OptimisticMutationConfig<TData, TVariables, TError>) {
	const queryClient = useQueryClient();

	return useMutation<TData, TError, TVariables, OptimisticContext<TData>>({
		mutationFn,
		...options,

		onMutate: async (variables) => {
			// Cancel any outgoing refetches so they don't overwrite our optimistic update
			await queryClient.cancelQueries({ queryKey });

			// Snapshot the previous value for rollback
			const previous = queryClient.getQueryData<TData>(queryKey);

			// Optimistically update the cache
			queryClient.setQueryData<TData>(queryKey, (oldData) => updater(oldData, variables));

			return { previous };
		},

		onError: (_error, _variables, context) => {
			// Roll back to the snapshot on error
			if (context?.previous !== undefined) {
				queryClient.setQueryData(queryKey, context.previous);
			}
		},

		onSettled: () => {
			// Always refetch after mutation to ensure server state consistency
			queryClient.invalidateQueries({ queryKey });

			// Invalidate related domains
			for (const relatedKey of relatedKeys) {
				queryClient.invalidateQueries({ queryKey: relatedKey });
			}
		},
	});
}

// ---------------------------------------------------------------------------
// useOptimisticListMutation — specialised for list append/remove/update
// ---------------------------------------------------------------------------

/** Item type constraint: must have an `id` field */
interface Identifiable {
	id: string;
}

/** Operations supported by useOptimisticListMutation */
type ListOperation = "add" | "remove" | "update";

interface OptimisticListConfig<TItem extends Identifiable, TVariables, TError = Error> {
	/** Server-side mutation function */
	mutationFn: (variables: TVariables) => Promise<TItem>;
	/** Query key for the list */
	queryKey: QueryKey;
	/** Which list operation to perform */
	operation: ListOperation;
	/**
	 * Extract the item to add/update from mutation variables.
	 * For "remove", only `id` is needed.
	 * For "add"/"update", should return a full optimistic item.
	 */
	getItem: (variables: TVariables) => TItem;
	/** For "remove": extract the item ID from variables */
	getId?: (variables: TVariables) => string;
	/** Additional query keys to invalidate on settlement */
	relatedKeys?: QueryKey[];
	/** Optional TanStack Query mutation options to merge */
	options?: Omit<
		UseMutationOptions<TItem, TError, TVariables, OptimisticContext<TItem[]>>,
		"mutationFn" | "onMutate" | "onError" | "onSettled"
	>;
}

/**
 * Specialised optimistic mutation for list CRUD operations.
 *
 * Handles add/remove/update of items in a cached array, with automatic
 * rollback and invalidation.
 *
 * @example
 * ```ts
 * const deleteScenario = useOptimisticListMutation({
 *   mutationFn: (id) => rpc.scenarios().delete(id),
 *   queryKey: queryKeys.scenarios.all,
 *   operation: "remove",
 *   getItem: (id) => ({ id } as Scenario),
 *   getId: (id) => id,
 * });
 * ```
 */
export function useOptimisticListMutation<TItem extends Identifiable, TVariables, TError = Error>({
	mutationFn,
	queryKey,
	operation,
	getItem,
	getId,
	relatedKeys = [],
	options = {},
}: OptimisticListConfig<TItem, TVariables, TError>) {
	const queryClient = useQueryClient();

	return useMutation<TItem, TError, TVariables, OptimisticContext<TItem[]>>({
		mutationFn,
		...options,

		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<TItem[]>(queryKey);

			queryClient.setQueryData<TItem[]>(queryKey, (oldList) => {
				const list = oldList ?? [];

				if (operation === "add") {
					return [...list, getItem(variables)];
				}
				if (operation === "remove") {
					const removeId = getId ? getId(variables) : getItem(variables).id;
					return list.filter((item) => item.id !== removeId);
				}
				if (operation === "update") {
					const updated = getItem(variables);
					return list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
				}
				return operation satisfies never;
			});

			return { previous };
		},

		onError: (_error, _variables, context) => {
			if (context?.previous !== undefined) {
				queryClient.setQueryData(queryKey, context.previous);
			}
		},

		onSettled: () => {
			queryClient.invalidateQueries({ queryKey });
			for (const relatedKey of relatedKeys) {
				queryClient.invalidateQueries({ queryKey: relatedKey });
			}
		},
	});
}
