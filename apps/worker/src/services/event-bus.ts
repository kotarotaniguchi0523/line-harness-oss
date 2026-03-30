/**
 * イベントバス — システム内イベントの発火と処理
 *
 * イベント発生時に以下を実行:
 * 1. アクティブな送信Webhookへ通知
 * 2. スコアリングルール適用
 * 3. 自動化ルール(IF-THEN)実行
 * 4. 通知ルール処理
 */

import {
	createAutomationRepository,
	createDb,
	createNotificationRepository,
	createScoringRepository,
	createWebhookConfigRepository,
	DateTime,
} from "@line-crm/db";
import type { AutomationId, FriendId } from "@line-crm/domain";
import { executeAction } from "./action-executor.js";
import { sendAdConversions } from "./ad-conversion.js";

export interface EventPayload {
	friendId?: string;
	eventData?: Record<string, unknown>;
	conversionEventName?: string;
	conversionValue?: number;
}

/**
 * イベントを発火し、登録された全ハンドラーを実行
 */
export async function fireEvent(
	db: D1Database,
	eventType: string,
	payload: EventPayload,
	lineAccessToken?: string,
	lineAccountId?: string | null,
): Promise<void> {
	const jobs: Promise<unknown>[] = [
		fireOutgoingWebhooks(db, eventType, payload),
		processScoring(db, eventType, payload),
		processAutomations(db, eventType, payload, lineAccessToken, lineAccountId),
		processNotifications(db, eventType, payload, lineAccountId),
	];

	// Ad conversion postback
	if (payload.friendId && payload.conversionEventName) {
		jobs.push(sendAdConversions(db, payload.friendId, payload.conversionEventName, payload.conversionValue));
	}

	await Promise.allSettled(jobs);
}

/** 送信Webhookへの通知 */
async function fireOutgoingWebhooks(db: D1Database, eventType: string, payload: EventPayload): Promise<void> {
	try {
		const drizzle = createDb(db);
		const webhookRepo = createWebhookConfigRepository(drizzle);
		const webhooks = await webhookRepo.findActiveByEvent(eventType);
		for (const wh of webhooks) {
			try {
				const body = JSON.stringify({
					event: eventType,
					timestamp: DateTime.now().toISO(),
					data: payload,
				});

				const headers: Record<string, string> = { "Content-Type": "application/json" };

				// HMAC署名（シークレットがある場合）
				if (wh.secret) {
					const encoder = new TextEncoder();
					const key = await crypto.subtle.importKey(
						"raw",
						encoder.encode(wh.secret),
						{ name: "HMAC", hash: "SHA-256" },
						false,
						["sign"],
					);
					const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
					const hexSignature = Array.from(new Uint8Array(signature))
						.map((b) => b.toString(16).padStart(2, "0"))
						.join("");
					headers["X-Webhook-Signature"] = hexSignature;
				}

				await fetch(wh.url, { method: "POST", headers, body });
			} catch (err) {
				console.error(`送信Webhook ${wh.id} への通知失敗:`, err);
			}
		}
	} catch (err) {
		console.error("fireOutgoingWebhooks error:", err);
	}
}

/** スコアリングルール適用 */
async function processScoring(db: D1Database, eventType: string, payload: EventPayload): Promise<void> {
	if (!payload.friendId) return;
	try {
		const drizzle = createDb(db);
		const scoringRepo = createScoringRepository(drizzle);
		await scoringRepo.applyScore(payload.friendId as FriendId, eventType);
	} catch (err) {
		console.error("processScoring error:", err);
	}
}

/** 自動化ルール(IF-THEN)実行 */
async function processAutomations(
	db: D1Database,
	eventType: string,
	payload: EventPayload,
	lineAccessToken?: string,
	lineAccountId?: string | null,
): Promise<void> {
	try {
		const drizzle = createDb(db);
		const automationRepo = createAutomationRepository(drizzle);
		const allAutomations = await automationRepo.findActiveByEvent(eventType);
		// Filter by account: match this account's automations + unassigned (backward compat)
		const automations = allAutomations.filter((a) => {
			const lineAccId =
				(a as unknown as Record<string, unknown>).lineAccountId ??
				(a as unknown as Record<string, unknown>).line_account_id;
			return !(lineAccId && lineAccountId) || lineAccId === lineAccountId;
		});

		for (const automation of automations) {
			const rawConditions = (automation as unknown as Record<string, unknown>).conditions;
			const rawActions = (automation as unknown as Record<string, unknown>).actions;
			const conditions = (typeof rawConditions === "string" ? JSON.parse(rawConditions) : rawConditions) as Record<
				string,
				unknown
			>;
			const actions = (typeof rawActions === "string" ? JSON.parse(rawActions) : rawActions) as Array<{
				type: string;
				params: Record<string, string>;
			}>;

			// 条件チェック（簡易版: 条件が空なら常にマッチ）
			if (!matchConditions(conditions, payload)) continue;

			const results: Array<{ action: string; success: boolean; error?: string }> = [];

			const actionDeps = { db, lineAccessToken };
			for (const action of actions) {
				try {
					await executeAction(actionDeps, action, payload);
					results.push({ action: action.type, success: true });
				} catch (err) {
					const errorMsg = err instanceof Error ? err.message : String(err);
					results.push({ action: action.type, success: false, error: errorMsg });
				}
			}

			const allSuccess = results.every((r) => r.success);
			const anySuccess = results.some((r) => r.success);

			await automationRepo.logExecution({
				automationId: (automation as unknown as Record<string, unknown>).id as AutomationId,
				friendId: payload.friendId as FriendId | undefined,
				eventData: JSON.stringify(payload.eventData ?? {}),
				actionsResult: JSON.stringify(results),
				status: allSuccess ? "success" : anySuccess ? "partial" : "failed",
			});
		}
	} catch (err) {
		console.error("processAutomations error:", err);
	}
}

/** 条件マッチング */
function matchConditions(conditions: Record<string, unknown>, payload: EventPayload): boolean {
	// 条件が空 → 常にマッチ
	if (Object.keys(conditions).length === 0) return true;

	// score_threshold チェック
	if (conditions.score_threshold !== undefined && payload.eventData) {
		const currentScore = payload.eventData.currentScore as number | undefined;
		if (currentScore !== undefined && currentScore < (conditions.score_threshold as number)) {
			return false;
		}
	}

	// tag_id チェック
	if (conditions.tag_id !== undefined && payload.eventData) {
		if (payload.eventData.tagId !== conditions.tag_id) return false;
	}

	// keyword チェック（message_received イベント用）
	if (conditions.keyword !== undefined && payload.eventData) {
		const text = payload.eventData.text as string | undefined;
		if (!text?.includes(conditions.keyword as string)) return false;
	}

	return true;
}

/** 通知ルール処理 */
async function processNotifications(
	db: D1Database,
	eventType: string,
	payload: EventPayload,
	lineAccountId?: string | null,
): Promise<void> {
	try {
		const drizzle = createDb(db);
		const notifRepo = createNotificationRepository(drizzle);
		const allRules = await notifRepo.findActiveRulesByEvent(eventType);
		const rules = allRules.filter((r) => {
			const lineAccId =
				(r as unknown as Record<string, unknown>).lineAccountId ??
				(r as unknown as Record<string, unknown>).line_account_id;
			return !(lineAccId && lineAccountId) || lineAccId === lineAccountId;
		});

		for (const rule of rules) {
			const rawChannels = (rule as unknown as Record<string, unknown>).channels;
			let channels: string[] = typeof rawChannels === "string" ? JSON.parse(rawChannels) : (rawChannels as string[]);
			// Guard against double-encoded JSON strings
			if (typeof channels === "string") channels = JSON.parse(channels);

			for (const channel of channels) {
				await notifRepo.createNotification({
					ruleId: (rule as unknown as Record<string, unknown>).id as string,
					eventType,
					title: `${(rule as unknown as Record<string, unknown>).name}: ${eventType}`,
					body: JSON.stringify(payload),
					channel,
					metadata: JSON.stringify(payload.eventData ?? {}),
				});

				// Webhook通知チャネルの場合は即時配信
				if (channel === "webhook") {
					// 送信Webhookと統合（既にfireOutgoingWebhooksで処理済み）
				}
				// email チャネルの場合はSendGrid等で送信（将来実装）
				// dashboard チャネルの場合はDB記録のみ（上記createNotificationで完了）
			}
		}
	} catch (err) {
		console.error("processNotifications error:", err);
	}
}
