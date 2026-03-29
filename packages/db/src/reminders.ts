import { DateTime } from "./utils.js";
// リマインダ配信クエリヘルパー

export interface ReminderRow {
	id: string;
	name: string;
	description: string | null;
	is_active: number;
	created_at: string;
	updated_at: string;
}

export interface ReminderStepRow {
	id: string;
	reminder_id: string;
	offset_minutes: number;
	message_type: string;
	message_content: string;
	created_at: string;
}

export interface FriendReminderRow {
	id: string;
	friend_id: string;
	reminder_id: string;
	target_date: string;
	status: string;
	created_at: string;
	updated_at: string;
}

// --- リマインダCRUD ---

export async function getReminders(db: D1Database): Promise<ReminderRow[]> {
	const result = await db.prepare("SELECT * FROM reminders ORDER BY created_at DESC").all<ReminderRow>();
	return result.results;
}

export async function getReminderById(db: D1Database, id: string): Promise<ReminderRow | null> {
	return db.prepare("SELECT * FROM reminders WHERE id = ?").bind(id).first<ReminderRow>();
}

export async function createReminder(
	db: D1Database,
	input: { name: string; description?: string },
): Promise<ReminderRow> {
	const id = crypto.randomUUID();
	const now = DateTime.now().toISO();
	await db
		.prepare("INSERT INTO reminders (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
		.bind(id, input.name, input.description ?? null, now, now)
		.run();
	const created = await getReminderById(db, id);
	if (!created) throw new Error(`Failed to retrieve reminder after insert: ${id}`);
	return created;
}

export async function updateReminder(
	db: D1Database,
	id: string,
	updates: Partial<{ name: string; description: string; isActive: boolean }>,
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];
	if (updates.name !== undefined) {
		sets.push("name = ?");
		values.push(updates.name);
	}
	if (updates.description !== undefined) {
		sets.push("description = ?");
		values.push(updates.description);
	}
	if (updates.isActive !== undefined) {
		sets.push("is_active = ?");
		values.push(updates.isActive ? 1 : 0);
	}
	if (sets.length === 0) return;
	sets.push("updated_at = ?");
	values.push(DateTime.now().toISO());
	values.push(id);
	await db
		.prepare(`UPDATE reminders SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function deleteReminder(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM reminders WHERE id = ?").bind(id).run();
}

// --- リマインダステップ ---

export async function getReminderSteps(db: D1Database, reminderId: string): Promise<ReminderStepRow[]> {
	const result = await db
		.prepare("SELECT * FROM reminder_steps WHERE reminder_id = ? ORDER BY offset_minutes ASC")
		.bind(reminderId)
		.all<ReminderStepRow>();
	return result.results;
}

export async function createReminderStep(
	db: D1Database,
	input: { reminderId: string; offsetMinutes: number; messageType: string; messageContent: string },
): Promise<ReminderStepRow> {
	const id = crypto.randomUUID();
	const now = DateTime.now().toISO();
	await db
		.prepare(
			"INSERT INTO reminder_steps (id, reminder_id, offset_minutes, message_type, message_content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(id, input.reminderId, input.offsetMinutes, input.messageType, input.messageContent, now)
		.run();
	const created = await db.prepare("SELECT * FROM reminder_steps WHERE id = ?").bind(id).first<ReminderStepRow>();
	if (!created) throw new Error(`Failed to retrieve reminder step after insert: ${id}`);
	return created;
}

export async function deleteReminderStep(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM reminder_steps WHERE id = ?").bind(id).run();
}

// --- 友だちリマインダ ---

export async function enrollFriendInReminder(
	db: D1Database,
	input: { friendId: string; reminderId: string; targetDate: string },
): Promise<FriendReminderRow> {
	const id = crypto.randomUUID();
	const now = DateTime.now().toISO();
	await db
		.prepare(
			"INSERT INTO friend_reminders (id, friend_id, reminder_id, target_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(id, input.friendId, input.reminderId, input.targetDate, now, now)
		.run();
	const created = await db.prepare("SELECT * FROM friend_reminders WHERE id = ?").bind(id).first<FriendReminderRow>();
	if (!created) throw new Error(`Failed to retrieve friend reminder after insert: ${id}`);
	return created;
}

export async function getFriendReminders(db: D1Database, friendId: string): Promise<FriendReminderRow[]> {
	const result = await db
		.prepare("SELECT * FROM friend_reminders WHERE friend_id = ? ORDER BY target_date ASC")
		.bind(friendId)
		.all<FriendReminderRow>();
	return result.results;
}

export async function cancelFriendReminder(db: D1Database, id: string): Promise<void> {
	await db
		.prepare(`UPDATE friend_reminders SET status = 'cancelled', updated_at = ? WHERE id = ?`)
		.bind(DateTime.now().toISO(), id)
		.run();
}

/** リマインダ配信処理用: 配信が必要な友だちリマインダを取得 */
export async function getDueReminderDeliveries(
	db: D1Database,
	now: string,
): Promise<Array<FriendReminderRow & { steps: ReminderStepRow[] }>> {
	// Single JOIN query: fetch active friend_reminders with their undelivered steps
	const rows = await db
		.prepare(
			`SELECT fr.id AS fr_id, fr.friend_id, fr.reminder_id, fr.target_date,
              fr.status AS fr_status, fr.created_at AS fr_created_at, fr.updated_at AS fr_updated_at,
              rs.id AS rs_id, rs.reminder_id AS rs_reminder_id, rs.offset_minutes,
              rs.message_type, rs.message_content, rs.created_at AS rs_created_at
       FROM friend_reminders fr
       INNER JOIN reminders r ON r.id = fr.reminder_id
       INNER JOIN reminder_steps rs ON rs.reminder_id = fr.reminder_id
       LEFT JOIN friend_reminder_deliveries frd
         ON frd.friend_reminder_id = fr.id AND frd.reminder_step_id = rs.id
       WHERE fr.status = 'active'
         AND r.is_active = 1
         AND frd.id IS NULL`,
		)
		.all<{
			fr_id: string;
			friend_id: string;
			reminder_id: string;
			target_date: string;
			fr_status: string;
			fr_created_at: string;
			fr_updated_at: string;
			rs_id: string;
			rs_reminder_id: string;
			offset_minutes: number;
			message_type: string;
			message_content: string;
			rs_created_at: string;
		}>();

	const nowMs = new Date(now).getTime();
	const grouped = new Map<string, FriendReminderRow & { steps: ReminderStepRow[] }>();

	for (const row of rows.results) {
		// Check if this step is due based on target_date + offset
		const targetTime = new Date(row.target_date).getTime() + row.offset_minutes * 60_000;
		if (targetTime > nowMs) continue;

		let entry = grouped.get(row.fr_id);
		if (!entry) {
			entry = {
				id: row.fr_id,
				friend_id: row.friend_id,
				reminder_id: row.reminder_id,
				target_date: row.target_date,
				status: row.fr_status,
				created_at: row.fr_created_at,
				updated_at: row.fr_updated_at,
				steps: [],
			};
			grouped.set(row.fr_id, entry);
		}

		entry.steps.push({
			id: row.rs_id,
			reminder_id: row.rs_reminder_id,
			offset_minutes: row.offset_minutes,
			message_type: row.message_type,
			message_content: row.message_content,
			created_at: row.rs_created_at,
		});
	}

	return Array.from(grouped.values());
}

/** 配信済みを記録 */
export async function markReminderStepDelivered(
	db: D1Database,
	friendReminderId: string,
	reminderStepId: string,
): Promise<void> {
	const id = crypto.randomUUID();
	await db
		.prepare(
			"INSERT OR IGNORE INTO friend_reminder_deliveries (id, friend_reminder_id, reminder_step_id) VALUES (?, ?, ?)",
		)
		.bind(id, friendReminderId, reminderStepId)
		.run();
}

/** 全ステップ配信済みならcompletedにする */
export async function completeReminderIfDone(
	db: D1Database,
	friendReminderId: string,
	reminderId: string,
): Promise<void> {
	const totalSteps = await db
		.prepare("SELECT COUNT(*) as count FROM reminder_steps WHERE reminder_id = ?")
		.bind(reminderId)
		.first<{ count: number }>();
	const deliveredSteps = await db
		.prepare("SELECT COUNT(*) as count FROM friend_reminder_deliveries WHERE friend_reminder_id = ?")
		.bind(friendReminderId)
		.first<{ count: number }>();

	if (totalSteps && deliveredSteps && deliveredSteps.count >= totalSteps.count) {
		await db
			.prepare(`UPDATE friend_reminders SET status = 'completed', updated_at = ? WHERE id = ?`)
			.bind(DateTime.now().toISO(), friendReminderId)
			.run();
	}
}
