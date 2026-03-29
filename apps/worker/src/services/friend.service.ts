// =============================================================================
// Friend Service - CRM Bounded Context
//
// Unified service with CQRS separation at the type level.
// Read-only queries go directly to the repository layer.
// Write commands validate through aggregates (TODO) and produce domain events.
// Authorization is enforced on both sides; no domain events from queries.
// =============================================================================

import type { Database } from "@line-crm/db/drizzle";
import { createFriendRepository } from "@line-crm/db/repositories/friend.repository";
import type { FriendId, LineAccountId, TagId } from "@line-crm/domain";
import {
	assertReadAccess,
	assertWriteAccess,
	type CommandResult,
	CommonErrors,
	err,
	ok,
	type QueryResult,
	type StaffContext,
} from "./cqrs-types.js";

// ---------------------------------------------------------------------------
// Repository return type helpers (inferred from the repo layer)
// ---------------------------------------------------------------------------

type FriendRepo = ReturnType<typeof createFriendRepository>;
type FriendWithTags = Awaited<ReturnType<FriendRepo["findById"]>> & {};
type ListFriendsOptions = Parameters<FriendRepo["listWithTags"]>[0];
type ListFriendsResult = Awaited<ReturnType<FriendRepo["listWithTags"]>>;

// ---------------------------------------------------------------------------
// Command DTOs -- explicit data structures for each mutation
// ---------------------------------------------------------------------------

export interface AssignTagCommand {
	readonly friendId: FriendId;
	readonly tagId: TagId;
}

export interface RemoveTagCommand {
	readonly friendId: FriendId;
	readonly tagId: TagId;
}

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

const Messages = {
	INSUFFICIENT_READ: "Insufficient permissions to read friend data",
	INSUFFICIENT_WRITE: "Only owner or admin can modify friend data",
	LINE_ACCOUNT_ID_REQUIRED: "lineAccountId is required for list operations",
	FRIEND_NOT_FOUND: "Friend not found",
} as const;

// ---------------------------------------------------------------------------
// Factory: create friend service bound to a database instance
// ---------------------------------------------------------------------------

export function createFriendService(db: Database) {
	const repo = createFriendRepository(db);

	const queries = {
		/**
		 * List friends with pagination, tag filter, and search.
		 * Enforces read authorization and mandatory lineAccountId scoping.
		 */
		async listFriends(staff: StaffContext, opts: ListFriendsOptions): Promise<QueryResult<ListFriendsResult>> {
			const authError = assertReadAccess(staff, Messages.INSUFFICIENT_READ);
			if (authError) return err(authError);

			// Account scope is mandatory for list operations to prevent cross-account leaks
			if (!opts.lineAccountId) {
				return err({
					code: CommonErrors.ACCOUNT_SCOPE_REQUIRED,
					message: Messages.LINE_ACCOUNT_ID_REQUIRED,
				});
			}

			const result = await repo.listWithTags(opts);
			return ok(result);
		},

		/**
		 * Get a single friend by ID.
		 * Enforces read authorization.
		 */
		async getFriend(staff: StaffContext, id: FriendId): Promise<QueryResult<NonNullable<FriendWithTags>>> {
			const authError = assertReadAccess(staff, Messages.INSUFFICIENT_READ);
			if (authError) return err(authError);

			const friend = await repo.findById(id);
			if (!friend) {
				return err({
					code: CommonErrors.NOT_FOUND,
					message: Messages.FRIEND_NOT_FOUND,
				});
			}
			return ok(friend);
		},

		/**
		 * Count friends, optionally scoped to a line account.
		 * Enforces read authorization.
		 */
		async countFriends(staff: StaffContext, lineAccountId?: LineAccountId): Promise<QueryResult<number>> {
			const authError = assertReadAccess(staff, Messages.INSUFFICIENT_READ);
			if (authError) return err(authError);

			const count = await repo.count(lineAccountId);
			return ok(count);
		},
	};

	const commands = {
		/**
		 * Assign a tag to a friend.
		 * Only owner/admin can modify tags.
		 *
		 * TODO: Load FriendAggregate, call aggregate.assignTag(tagId),
		 *       persist via repository, then emit FriendTagAssigned domain event.
		 */
		async assignTag(staff: StaffContext, cmd: AssignTagCommand): Promise<CommandResult<void>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			await repo.assignTag(cmd.friendId, cmd.tagId);
			return ok(undefined);
		},

		/**
		 * Remove a tag from a friend.
		 * Only owner/admin can modify tags.
		 *
		 * TODO: Load FriendAggregate, call aggregate.removeTag(tagId),
		 *       persist via repository, then emit FriendTagRemoved domain event.
		 */
		async removeTag(staff: StaffContext, cmd: RemoveTagCommand): Promise<CommandResult<void>> {
			const authError = assertWriteAccess(staff, Messages.INSUFFICIENT_WRITE);
			if (authError) return err(authError);

			await repo.removeTag(cmd.friendId, cmd.tagId);
			return ok(undefined);
		},
	};

	return { queries, commands };
}

// ---------------------------------------------------------------------------
// Exported types for consumers that need the handler shapes
// ---------------------------------------------------------------------------

export type FriendService = ReturnType<typeof createFriendService>;
export type FriendQueries = FriendService["queries"];
export type FriendCommands = FriendService["commands"];
