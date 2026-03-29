// =============================================================================
// Friends RPC - Cap'n Web RpcTarget
//
// Thin presentation layer: validates input, delegates to FriendService,
// and converts service Result to RPC response (throw on error).
// =============================================================================

import { type ListFriendsQuery, PaginationInputSchema, UuidSchema } from "@line-crm/contracts";
import type { Database } from "@line-crm/db/drizzle";
import { friendId, lineAccountId as toLineAccountId, tagId as toTagId } from "@line-crm/domain";
import { RpcTarget } from "capnweb";
import { z } from "zod";
import { createFriendService, type FriendCommands, type FriendQueries } from "../services/friend.service.js";

import type { StaffContext } from "./types.js";
import { formatZodError, throwServiceError } from "./utils.js";

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const FriendsListInputSchema = PaginationInputSchema.extend({
	tagId: UuidSchema.optional(),
	lineAccountId: UuidSchema.optional(),
	search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// RPC Target
// ---------------------------------------------------------------------------

export class FriendsRpc extends RpcTarget {
	private queries: FriendQueries;
	private commands: FriendCommands;

	constructor(
		db: Database,
		private staff: StaffContext,
	) {
		super();
		const service = createFriendService(db);
		this.queries = service.queries;
		this.commands = service.commands;
	}

	async list(opts: Partial<ListFriendsQuery>) {
		const parseResult = FriendsListInputSchema.safeParse(opts);
		if (!parseResult.success) {
			throw new Error(formatZodError(parseResult.error));
		}
		const validated = parseResult.data;
		const { page, limit } = validated;

		const serviceResult = await this.queries.listFriends(this.staff, {
			page,
			limit,
			tagId: validated.tagId ? toTagId(validated.tagId) : undefined,
			lineAccountId: validated.lineAccountId ? toLineAccountId(validated.lineAccountId) : undefined,
			search: validated.search,
		});

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}

		const result = serviceResult.value;
		return {
			...result,
			page,
			limit,
			hasNextPage: result.total > page * limit,
		};
	}

	async get(id: string) {
		const idResult = UuidSchema.safeParse(id);
		if (!idResult.success) {
			throw new Error(formatZodError(idResult.error));
		}

		const serviceResult = await this.queries.getFriend(this.staff, friendId(idResult.data));

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}

	async assignTag(fId: string, tId: string) {
		const friendIdResult = UuidSchema.safeParse(fId);
		if (!friendIdResult.success) {
			throw new Error(formatZodError(friendIdResult.error));
		}
		const tagIdResult = UuidSchema.safeParse(tId);
		if (!tagIdResult.success) {
			throw new Error(formatZodError(tagIdResult.error));
		}

		const serviceResult = await this.commands.assignTag(this.staff, {
			friendId: friendId(friendIdResult.data),
			tagId: toTagId(tagIdResult.data),
		});

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
	}

	async removeTag(fId: string, tId: string) {
		const friendIdResult = UuidSchema.safeParse(fId);
		if (!friendIdResult.success) {
			throw new Error(formatZodError(friendIdResult.error));
		}
		const tagIdResult = UuidSchema.safeParse(tId);
		if (!tagIdResult.success) {
			throw new Error(formatZodError(tagIdResult.error));
		}

		const serviceResult = await this.commands.removeTag(this.staff, {
			friendId: friendId(friendIdResult.data),
			tagId: toTagId(tagIdResult.data),
		});

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
	}

	async count(lineAccId?: string) {
		let validAccountId: string | undefined;
		if (lineAccId) {
			const accountIdResult = UuidSchema.safeParse(lineAccId);
			if (!accountIdResult.success) {
				throw new Error(formatZodError(accountIdResult.error));
			}
			validAccountId = accountIdResult.data;
		}

		const serviceResult = await this.queries.countFriends(
			this.staff,
			validAccountId ? toLineAccountId(validAccountId) : undefined,
		);

		if (serviceResult.isErr()) {
			throwServiceError(serviceResult.error);
		}
		return serviceResult.value;
	}
}
