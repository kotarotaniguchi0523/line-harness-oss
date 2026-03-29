/**
 * リマインダ配信処理 — cronトリガーで定期実行
 *
 * target_date + offset_minutes の時刻が現在時刻以前で
 * まだ配信されていないステップを配信する
 */

import {
	completeReminderIfDone,
	createDb,
	DateTime,
	getDueReminderDeliveries,
	getFriendById,
	markReminderStepDelivered,
} from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import { addJitter, sleep } from "./stealth.js";

export async function processReminderDeliveries(db: D1Database, lineClient: LineClient): Promise<void> {
	const now = DateTime.now().toISO();
	const dueReminders = await getDueReminderDeliveries(db, now);

	for (let i = 0; i < dueReminders.length; i++) {
		const fr = dueReminders[i];
		try {
			// ステルス: バースト回避のためランダム遅延
			if (i > 0) {
				await sleep(addJitter(50, 200));
			}

			const friend = await getFriendById(db, fr.friend_id);
			if (!friend?.is_following) {
				// フォロー解除済み — スキップ
				continue;
			}

			for (const step of fr.steps) {
				const message = buildMessage(step.message_type, step.message_content);
				await lineClient.pushMessage(friend.line_user_id, [message]);

				// メッセージログに記録
				const drizzle = createDb(db);
				await drizzle.insert(messagesLog).values({
					id: crypto.randomUUID(),
					friendId: friend.id,
					direction: "outgoing",
					messageType: step.message_type,
					content: step.message_content,
				});

				// 配信済みを記録
				await markReminderStepDelivered(db, fr.id, step.id);
			}

			// 全ステップ配信済みかチェック
			await completeReminderIfDone(db, fr.id, fr.reminder_id);
		} catch (err) {
			console.error(`リマインダ配信エラー (friend_reminder ${fr.id}):`, err);
		}
	}
}
