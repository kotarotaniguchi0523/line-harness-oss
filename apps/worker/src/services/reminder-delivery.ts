/**
 * リマインダ配信処理 — cronトリガーで定期実行
 *
 * target_date + offset_minutes の時刻が現在時刻以前で
 * まだ配信されていないステップを配信する
 */

import { createDb, createFriendRepository, createReminderRepository, DateTime } from "@line-crm/db";
import type { FriendId, ReminderId } from "@line-crm/domain";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import { addJitter, sleep } from "./stealth.js";

export async function processReminderDeliveries(db: D1Database, lineClient: LineClient): Promise<void> {
	const drizzle = createDb(db);
	const reminderRepo = createReminderRepository(drizzle);
	const friendRepo = createFriendRepository(drizzle);
	const now = DateTime.now().toISO();
	const dueReminders = await reminderRepo.getDueDeliveries(now);

	for (let i = 0; i < dueReminders.length; i++) {
		const fr = dueReminders[i];
		try {
			// ステルス: バースト回避のためランダム遅延
			if (i > 0) {
				await sleep(addJitter(50, 200));
			}

			const friend = await friendRepo.findById(fr.friend_id as FriendId);
			if (!friend?.isFollowing) {
				// フォロー解除済み — スキップ
				continue;
			}

			for (const step of fr.steps) {
				const message = buildMessage(step.message_type, step.message_content);
				await lineClient.pushMessage(friend.lineUserId, [message]);

				// メッセージログに記録
				await friendRepo.logMessage({
					friendId: friend.id,
					direction: "outgoing",
					messageType: step.message_type,
					content: step.message_content,
				});

				// 配信済みを記録
				await reminderRepo.markDelivered(fr.id, step.id);
			}

			// 全ステップ配信済みかチェック
			await reminderRepo.completeIfDone(fr.id, fr.reminder_id as ReminderId);
		} catch (err) {
			console.error(`リマインダ配信エラー (friend_reminder ${fr.id}):`, err);
		}
	}
}
