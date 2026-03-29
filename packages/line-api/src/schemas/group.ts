// =============================================================================
// LINE Messaging API -- Group & Room Schemas (Zod)
// =============================================================================
//
// These schemas validate responses from the LINE group/room management APIs:
//   - GET /v2/bot/group/{groupId}/summary
//   - GET /v2/bot/group/{groupId}/members/ids
//   - GET /v2/bot/room/{roomId}/members/ids
//
// All types are inferred from Zod schemas (SSOT).
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Group Summary -- GET /v2/bot/group/{groupId}/summary
// ---------------------------------------------------------------------------

/**
 * Represents the summary information of a LINE group.
 * Returned by the Group Summary API endpoint.
 *
 * @see https://developers.line.biz/en/reference/messaging-api/#get-group-summary
 */
export const GroupSummarySchema = z.object({
	/** LINE group ID */
	groupId: z.string(),
	/** Display name of the group */
	groupName: z.string(),
	/** URL of the group's icon image (may not exist for groups without icons) */
	pictureUrl: z.string().optional(),
});

export type GroupSummary = z.infer<typeof GroupSummarySchema>;

// ---------------------------------------------------------------------------
// Group/Room Member IDs -- paginated response
// ---------------------------------------------------------------------------

/**
 * Paginated list of member user IDs within a group or room.
 * The `next` token is present when there are more pages to fetch.
 *
 * @see https://developers.line.biz/en/reference/messaging-api/#get-group-member-user-ids
 * @see https://developers.line.biz/en/reference/messaging-api/#get-room-member-user-ids
 */
export const GroupMemberIdsSchema = z.object({
	/** Array of LINE user IDs belonging to the group/room */
	memberUserIds: z.array(z.string()),
	/** Continuation token for fetching the next page (absent on last page) */
	next: z.string().optional(),
});

export type GroupMemberIds = z.infer<typeof GroupMemberIdsSchema>;

// ---------------------------------------------------------------------------
// Allowed source types for LINE webhook events
// ---------------------------------------------------------------------------

/**
 * LINE event source types that distinguish the origin of a chat.
 * Used to categorize chats as direct (user), group, or room.
 */
export const LINE_SOURCE_TYPES = ["user", "group", "room"] as const;
export type LineSourceType = (typeof LINE_SOURCE_TYPES)[number];
