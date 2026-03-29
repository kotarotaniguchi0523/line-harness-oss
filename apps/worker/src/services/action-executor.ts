/**
 * Action Executor — 自動化アクションの型安全なディスパッチテーブル実行
 *
 * event-bus.ts の switch ブロックを排除し、AutomationActionType ごとに
 * ハンドラーを純粋なテーブルルックアップで呼び出す。
 *
 * 新しいアクションタイプを追加するには handlers テーブルにエントリを足すだけでよい。
 */

import type { AutomationActionType } from "@line-crm/contracts";
import {
	addTagToFriend,
	createDb,
	createFriendRepository,
	DateTime,
	enrollFriendInScenario,
	removeTagFromFriend,
} from "@line-crm/db";
import { friends } from "@line-crm/db/schema";
import type { FriendId } from "@line-crm/domain";
import { LineClient } from "@line-crm/line-sdk";
import { eq } from "drizzle-orm";
import type { EventPayload } from "./event-bus.js";

// ---------------------------------------------------------------------------
// Dependencies injected into each handler
// ---------------------------------------------------------------------------

export interface ActionDeps {
	db: D1Database;
	lineAccessToken?: string;
}

// ---------------------------------------------------------------------------
// Per-action parameter shapes
// ---------------------------------------------------------------------------

interface ActionParams {
	add_tag: { tagId: string };
	remove_tag: { tagId: string };
	start_scenario: { scenarioId: string };
	send_message: { messageType?: string; content: string; altText?: string };
	send_webhook: { url: string };
	switch_rich_menu: { richMenuId: string };
	remove_rich_menu: Record<string, never>;
	set_metadata: { data?: string };
}

// ---------------------------------------------------------------------------
// Handler type
// ---------------------------------------------------------------------------

type ActionHandler<K extends keyof ActionParams> = (
	deps: ActionDeps,
	friendId: string,
	params: ActionParams[K],
	payload: EventPayload,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Shared helper: resolve LINE user id from friend id
// ---------------------------------------------------------------------------

async function resolveLineUserId(db: D1Database, friendId: string): Promise<string | null> {
	const drizzle = createDb(db);
	const friendRepo = createFriendRepository(drizzle);
	const friend = await friendRepo.findById(friendId as FriendId);
	return friend?.lineUserId ?? null;
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const handlers: { [K in keyof ActionParams]: ActionHandler<K> } = {
	add_tag: async (deps, friendId, params) => {
		await addTagToFriend(deps.db, friendId, params.tagId);
	},

	remove_tag: async (deps, friendId, params) => {
		await removeTagFromFriend(deps.db, friendId, params.tagId);
	},

	start_scenario: async (deps, friendId, params) => {
		await enrollFriendInScenario(deps.db, friendId, params.scenarioId);
	},

	send_message: async (deps, friendId, params) => {
		if (!deps.lineAccessToken) return;
		const lineUserId = await resolveLineUserId(deps.db, friendId);
		if (!lineUserId) return;

		const lineClient = new LineClient(deps.lineAccessToken);
		const msgType = params.messageType || "text";

		if (msgType === "flex") {
			const contents = JSON.parse(params.content);
			await lineClient.pushMessage(lineUserId, [{ type: "flex", altText: params.altText || "Message", contents }]);
		} else {
			await lineClient.pushMessage(lineUserId, [{ type: "text", text: params.content }]);
		}
	},

	send_webhook: async (_deps, friendId, params, payload) => {
		if (!params.url) return;
		await fetch(params.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ friendId, ...payload.eventData }),
		});
	},

	switch_rich_menu: async (deps, friendId, params) => {
		if (!deps.lineAccessToken) return;
		const lineUserId = await resolveLineUserId(deps.db, friendId);
		if (!lineUserId) return;

		const lineClient = new LineClient(deps.lineAccessToken);
		await lineClient.linkRichMenuToUser(lineUserId, params.richMenuId);
	},

	remove_rich_menu: async (deps, friendId) => {
		if (!deps.lineAccessToken) return;
		const lineUserId = await resolveLineUserId(deps.db, friendId);
		if (!lineUserId) return;

		const lineClient = new LineClient(deps.lineAccessToken);
		await lineClient.unlinkRichMenuFromUser(lineUserId);
	},

	set_metadata: async (deps, friendId, params) => {
		const drizzle = createDb(deps.db);
		const friendRepo = createFriendRepository(drizzle);
		const existing = await friendRepo.findById(friendId as FriendId);
		const current = JSON.parse(existing?.metadata || "{}") as Record<string, unknown>;
		const patch = JSON.parse(params.data || "{}") as Record<string, unknown>;
		const merged = { ...current, ...patch };
		await drizzle
			.update(friends)
			.set({ metadata: JSON.stringify(merged), updatedAt: DateTime.now().toISO() })
			.where(eq(friends.id, friendId));
	},
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute an automation action by dispatching to the appropriate handler.
 *
 * Unknown action types emit a warning and are silently skipped.
 */
export async function executeAction(
	deps: ActionDeps,
	action: { type: string; params: Record<string, string> },
	payload: EventPayload,
): Promise<void> {
	const friendId = payload.friendId;
	if (!friendId && action.type !== "send_webhook") {
		throw new Error("friendId is required for this action");
	}

	const handler = handlers[action.type as AutomationActionType];
	if (!handler) {
		console.warn(`未知のアクションタイプ: ${action.type}`);
		return;
	}

	// The params Record<string, string> is cast to the specific ActionParams shape.
	// Each handler accesses only the keys it needs; missing keys are handled gracefully.
	await (handler as ActionHandler<keyof ActionParams>)(
		deps,
		friendId ?? "",
		action.params as ActionParams[keyof ActionParams],
		payload,
	);
}
