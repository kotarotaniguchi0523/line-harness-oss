// =============================================================================
// LINE Messaging API Client - Direct fetch with Zod validation (NO SDK)
// =============================================================================

import { z } from "zod";
import {
	AddToUploadAudienceRequestSchema,
	type AudienceGroup,
	type CreateAudienceResponse,
	CreateAudienceResponseSchema,
	CreateClickAudienceRequestSchema,
	CreateImpressionAudienceRequestSchema,
	CreateUploadAudienceRequestSchema,
	type DeliveryResult,
	DeliveryResultSchema,
	type DemographicFilter,
	GetAudienceResponseSchema,
	type ListAudiencesResponse,
	ListAudiencesResponseSchema,
	type NarrowcastRecipient,
	NarrowcastRequestSchema,
} from "./schemas/audience.js";
import { type GroupMemberIds, GroupMemberIdsSchema, type GroupSummary, GroupSummarySchema } from "./schemas/group.js";
import {
	BroadcastRequestSchema,
	type Message,
	MulticastRequestSchema,
	PushMessageRequestSchema,
	ReplyMessageRequestSchema,
} from "./schemas/messages.js";
import { type UserProfile, UserProfileSchema } from "./schemas/profile.js";

const LINE_API_BASE = "https://api.line.me/v2/bot";

// ---------------------------------------------------------------------------
// Result type -- replaces thrown errors with explicit union
// ---------------------------------------------------------------------------
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export class LineApiClient {
	constructor(private readonly accessToken: string) {}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	private async request<T>(path: string, options: RequestInit, responseSchema?: z.ZodType<T>): Promise<ApiResult<T>> {
		let res: Response;
		try {
			res = await fetch(`${LINE_API_BASE}${path}`, {
				...options,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.accessToken}`,
					...options.headers,
				},
			});
		} catch (err) {
			return { ok: false, error: `Network error: ${String(err)}` };
		}

		if (!res.ok) {
			const body = await res.json().catch(() => res.text());
			return {
				ok: false,
				error: `LINE API Error ${res.status}: ${JSON.stringify(body)}`,
			};
		}

		if (res.status === 200 && responseSchema) {
			const json = await res.json();
			const parsed = responseSchema.safeParse(json);
			if (!parsed.success) {
				return {
					ok: false,
					error: `Response validation failed: ${parsed.error.message}`,
				};
			}
			return { ok: true, data: parsed.data };
		}

		return { ok: true, data: undefined as T };
	}

	// -------------------------------------------------------------------------
	// Profile
	// -------------------------------------------------------------------------

	async getProfile(userId: string): Promise<ApiResult<UserProfile>> {
		return this.request(`/profile/${userId}`, { method: "GET" }, UserProfileSchema);
	}

	// -------------------------------------------------------------------------
	// Messaging
	// -------------------------------------------------------------------------

	async pushMessage(to: string, messages: Message[]): Promise<ApiResult<void>> {
		const validated = PushMessageRequestSchema.safeParse({ to, messages });
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request("/message/push", {
			method: "POST",
			body: JSON.stringify(validated.data),
		});
	}

	async replyMessage(replyToken: string, messages: Message[]): Promise<ApiResult<void>> {
		const validated = ReplyMessageRequestSchema.safeParse({ replyToken, messages });
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request("/message/reply", {
			method: "POST",
			body: JSON.stringify(validated.data),
		});
	}

	async multicast(to: string[], messages: Message[]): Promise<ApiResult<void>> {
		const validated = MulticastRequestSchema.safeParse({ to, messages });
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request("/message/multicast", {
			method: "POST",
			body: JSON.stringify(validated.data),
		});
	}

	async broadcast(messages: Message[]): Promise<ApiResult<void>> {
		const validated = BroadcastRequestSchema.safeParse({ messages });
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request("/message/broadcast", {
			method: "POST",
			body: JSON.stringify(validated.data),
		});
	}

	// -------------------------------------------------------------------------
	// Rich Menu
	// -------------------------------------------------------------------------

	async getRichMenuList(): Promise<ApiResult<unknown[]>> {
		const schema = z.object({ richmenus: z.array(z.unknown()) });
		const result = await this.request("/richmenu/list", { method: "GET" }, schema);
		if (!result.ok) return result;
		return { ok: true, data: result.data.richmenus };
	}

	async setDefaultRichMenu(richMenuId: string): Promise<ApiResult<void>> {
		return this.request(`/user/all/richmenu/${richMenuId}`, { method: "POST" });
	}

	async linkRichMenuToUser(userId: string, richMenuId: string): Promise<ApiResult<void>> {
		return this.request(`/user/${userId}/richmenu/${richMenuId}`, { method: "POST" });
	}

	async unlinkRichMenuFromUser(userId: string): Promise<ApiResult<void>> {
		return this.request(`/user/${userId}/richmenu`, { method: "DELETE" });
	}

	// -------------------------------------------------------------------------
	// Narrowcast -- send messages to a subset of users
	// -------------------------------------------------------------------------

	async narrowcast(opts: {
		messages: Message[];
		recipient?: NarrowcastRecipient;
		demographic?: DemographicFilter;
		limit?: { max: number; upToRemainingQuota?: boolean };
	}): Promise<ApiResult<{ requestId: string }>> {
		const validated = NarrowcastRequestSchema.safeParse(opts);
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}

		// LINE API returns 202 Accepted with request-id header for narrowcast
		let res: Response;
		try {
			res = await fetch(`${LINE_API_BASE}/message/narrowcast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.accessToken}`,
				},
				body: JSON.stringify(validated.data),
			});
		} catch (err) {
			return { ok: false, error: `Network error: ${String(err)}` };
		}

		if (!res.ok) {
			const body = await res.json().catch(() => res.text());
			return {
				ok: false,
				error: `LINE API Error ${res.status}: ${JSON.stringify(body)}`,
			};
		}

		const requestId = res.headers.get("x-line-request-id") ?? "";
		return { ok: true, data: { requestId } };
	}

	// -------------------------------------------------------------------------
	// Audience Management
	// -------------------------------------------------------------------------

	async createUploadAudience(opts: {
		description: string;
		audiences: Array<{ id: string }>;
	}): Promise<ApiResult<CreateAudienceResponse>> {
		const validated = CreateUploadAudienceRequestSchema.safeParse(opts);
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request(
			"/audienceGroup/upload",
			{ method: "POST", body: JSON.stringify(validated.data) },
			CreateAudienceResponseSchema,
		);
	}

	async addToUploadAudience(opts: {
		audienceGroupId: number;
		audiences: Array<{ id: string }>;
	}): Promise<ApiResult<void>> {
		const validated = AddToUploadAudienceRequestSchema.safeParse(opts);
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request("/audienceGroup/upload", {
			method: "PUT",
			body: JSON.stringify(validated.data),
		});
	}

	async createClickAudience(opts: {
		description: string;
		requestId: string;
		clickUrl?: string;
	}): Promise<ApiResult<CreateAudienceResponse>> {
		const validated = CreateClickAudienceRequestSchema.safeParse(opts);
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request(
			"/audienceGroup/click",
			{ method: "POST", body: JSON.stringify(validated.data) },
			CreateAudienceResponseSchema,
		);
	}

	async createImpressionAudience(opts: {
		description: string;
		requestId: string;
	}): Promise<ApiResult<CreateAudienceResponse>> {
		const validated = CreateImpressionAudienceRequestSchema.safeParse(opts);
		if (!validated.success) {
			return { ok: false, error: `Request validation failed: ${validated.error.message}` };
		}
		return this.request(
			"/audienceGroup/imp",
			{ method: "POST", body: JSON.stringify(validated.data) },
			CreateAudienceResponseSchema,
		);
	}

	async getAudience(audienceGroupId: number): Promise<ApiResult<AudienceGroup>> {
		const result = await this.request(
			`/audienceGroup/${audienceGroupId}`,
			{ method: "GET" },
			GetAudienceResponseSchema,
		);
		if (!result.ok) return result;
		return { ok: true, data: result.data.audienceGroup };
	}

	async listAudiences(opts?: {
		page?: number;
		size?: number;
		status?: string;
	}): Promise<ApiResult<ListAudiencesResponse>> {
		const params = new URLSearchParams();
		if (opts?.page !== undefined) params.set("page", String(opts.page));
		if (opts?.size !== undefined) params.set("size", String(opts.size));
		if (opts?.status) params.set("status", opts.status);
		const query = params.toString();
		const path = query ? `/audienceGroup/list?${query}` : "/audienceGroup/list";
		return this.request(path, { method: "GET" }, ListAudiencesResponseSchema);
	}

	async deleteAudience(audienceGroupId: number): Promise<ApiResult<void>> {
		return this.request(`/audienceGroup/${audienceGroupId}`, { method: "DELETE" });
	}

	// -------------------------------------------------------------------------
	// Message Delivery Results
	// -------------------------------------------------------------------------

	async getMessageDeliveryBroadcast(date: string): Promise<ApiResult<DeliveryResult>> {
		return this.request(
			`/message/delivery/broadcast?date=${encodeURIComponent(date)}`,
			{ method: "GET" },
			DeliveryResultSchema,
		);
	}

	async getMessageDeliveryPush(date: string): Promise<ApiResult<DeliveryResult>> {
		return this.request(
			`/message/delivery/push?date=${encodeURIComponent(date)}`,
			{ method: "GET" },
			DeliveryResultSchema,
		);
	}

	// -------------------------------------------------------------------------
	// Group Management
	// -------------------------------------------------------------------------

	/**
	 * Get the summary (name, picture, ID) of a LINE group.
	 * @see https://developers.line.biz/en/reference/messaging-api/#get-group-summary
	 */
	async getGroupSummary(groupId: string): Promise<ApiResult<GroupSummary>> {
		return this.request(`/group/${encodeURIComponent(groupId)}/summary`, { method: "GET" }, GroupSummarySchema);
	}

	/**
	 * Get member user IDs of a LINE group (paginated).
	 * Pass the `start` continuation token to fetch subsequent pages.
	 * @see https://developers.line.biz/en/reference/messaging-api/#get-group-member-user-ids
	 */
	async getGroupMemberIds(groupId: string, start?: string): Promise<ApiResult<GroupMemberIds>> {
		const params = new URLSearchParams();
		if (start) params.set("start", start);
		const query = params.toString();
		const path = `/group/${encodeURIComponent(groupId)}/members/ids${query ? `?${query}` : ""}`;
		return this.request(path, { method: "GET" }, GroupMemberIdsSchema);
	}

	/**
	 * Get the profile of a specific member in a LINE group.
	 * Returns the same shape as the user profile endpoint.
	 * @see https://developers.line.biz/en/reference/messaging-api/#get-group-member-profile
	 */
	async getGroupMemberProfile(groupId: string, userId: string): Promise<ApiResult<UserProfile>> {
		return this.request(
			`/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`,
			{ method: "GET" },
			UserProfileSchema,
		);
	}

	/**
	 * Leave a LINE group. The bot will no longer receive events from this group.
	 * @see https://developers.line.biz/en/reference/messaging-api/#leave-group
	 */
	async leaveGroup(groupId: string): Promise<ApiResult<void>> {
		return this.request(`/group/${encodeURIComponent(groupId)}/leave`, { method: "POST" });
	}

	// -------------------------------------------------------------------------
	// Room Management (legacy multi-person chat)
	// -------------------------------------------------------------------------

	/**
	 * Get member user IDs of a LINE room (paginated).
	 * Pass the `start` continuation token to fetch subsequent pages.
	 * @see https://developers.line.biz/en/reference/messaging-api/#get-room-member-user-ids
	 */
	async getRoomMemberIds(roomId: string, start?: string): Promise<ApiResult<GroupMemberIds>> {
		const params = new URLSearchParams();
		if (start) params.set("start", start);
		const query = params.toString();
		const path = `/room/${encodeURIComponent(roomId)}/members/ids${query ? `?${query}` : ""}`;
		return this.request(path, { method: "GET" }, GroupMemberIdsSchema);
	}

	/**
	 * Leave a LINE room. The bot will no longer receive events from this room.
	 * @see https://developers.line.biz/en/reference/messaging-api/#leave-room
	 */
	async leaveRoom(roomId: string): Promise<ApiResult<void>> {
		return this.request(`/room/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
	}
}
