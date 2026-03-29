import { DateTime } from "./utils.js";
// オペレーター＆チャット管理クエリヘルパー

export interface OperatorRow {
	id: string;
	name: string;
	email: string;
	role: string;
	is_active: number;
	created_at: string;
	updated_at: string;
}

export interface ChatRow {
	id: string;
	source_type: string;
	group_id: string | null;
	room_id: string | null;
	friend_id: string | null;
	operator_id: string | null;
	status: string;
	notes: string | null;
	last_message_at: string | null;
	group_name: string | null;
	group_picture_url: string | null;
	member_count: number | null;
	created_at: string;
	updated_at: string;
}

/** Input for creating or updating a group/room chat record */
export interface UpsertGroupChatInput {
	sourceType: "group" | "room";
	groupId: string;
	groupName: string;
	groupPictureUrl: string | null;
	lineAccountId: string | null;
}

// --- オペレーター ---

export async function getOperators(db: D1Database): Promise<OperatorRow[]> {
	const result = await db.prepare("SELECT * FROM operators ORDER BY created_at DESC").all<OperatorRow>();
	return result.results;
}

export async function getOperatorById(db: D1Database, id: string): Promise<OperatorRow | null> {
	return db.prepare("SELECT * FROM operators WHERE id = ?").bind(id).first<OperatorRow>();
}

export async function createOperator(
	db: D1Database,
	input: { name: string; email: string; role?: string },
): Promise<OperatorRow> {
	const id = crypto.randomUUID();
	const now = DateTime.now().toISO();
	await db
		.prepare("INSERT INTO operators (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
		.bind(id, input.name, input.email, input.role ?? "operator", now, now)
		.run();
	const created = await getOperatorById(db, id);
	if (!created) throw new Error(`Failed to retrieve operator after insert: ${id}`);
	return created;
}

export async function updateOperator(
	db: D1Database,
	id: string,
	updates: Partial<{ name: string; email: string; role: string; isActive: boolean }>,
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];
	if (updates.name !== undefined) {
		sets.push("name = ?");
		values.push(updates.name);
	}
	if (updates.email !== undefined) {
		sets.push("email = ?");
		values.push(updates.email);
	}
	if (updates.role !== undefined) {
		sets.push("role = ?");
		values.push(updates.role);
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
		.prepare(`UPDATE operators SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function deleteOperator(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM operators WHERE id = ?").bind(id).run();
}

// --- チャット ---

export async function getChats(
	db: D1Database,
	opts: { status?: string; operatorId?: string } = {},
): Promise<ChatRow[]> {
	if (opts.status && opts.operatorId) {
		const result = await db
			.prepare("SELECT * FROM chats WHERE status = ? AND operator_id = ? ORDER BY last_message_at DESC")
			.bind(opts.status, opts.operatorId)
			.all<ChatRow>();
		return result.results;
	}
	if (opts.status) {
		const result = await db
			.prepare("SELECT * FROM chats WHERE status = ? ORDER BY last_message_at DESC")
			.bind(opts.status)
			.all<ChatRow>();
		return result.results;
	}
	if (opts.operatorId) {
		const result = await db
			.prepare("SELECT * FROM chats WHERE operator_id = ? ORDER BY last_message_at DESC")
			.bind(opts.operatorId)
			.all<ChatRow>();
		return result.results;
	}
	const result = await db.prepare("SELECT * FROM chats ORDER BY last_message_at DESC").all<ChatRow>();
	return result.results;
}

export async function getChatById(db: D1Database, id: string): Promise<ChatRow | null> {
	return db.prepare("SELECT * FROM chats WHERE id = ?").bind(id).first<ChatRow>();
}

export async function getChatByFriendId(db: D1Database, friendId: string): Promise<ChatRow | null> {
	return db
		.prepare("SELECT * FROM chats WHERE friend_id = ? ORDER BY created_at DESC LIMIT 1")
		.bind(friendId)
		.first<ChatRow>();
}

export async function createChat(db: D1Database, input: { friendId: string; operatorId?: string }): Promise<ChatRow> {
	const id = crypto.randomUUID();
	const now = DateTime.now().toISO();
	await db
		.prepare(
			"INSERT INTO chats (id, friend_id, operator_id, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(id, input.friendId, input.operatorId ?? null, now, now, now)
		.run();
	const created = await getChatById(db, id);
	if (!created) throw new Error(`Failed to retrieve chat after insert: ${id}`);
	return created;
}

export async function updateChat(
	db: D1Database,
	id: string,
	updates: Partial<{ operatorId: string | null; status: string; notes: string; lastMessageAt: string }>,
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];
	if (updates.operatorId !== undefined) {
		sets.push("operator_id = ?");
		values.push(updates.operatorId);
	}
	if (updates.status !== undefined) {
		sets.push("status = ?");
		values.push(updates.status);
	}
	if (updates.notes !== undefined) {
		sets.push("notes = ?");
		values.push(updates.notes);
	}
	if (updates.lastMessageAt !== undefined) {
		sets.push("last_message_at = ?");
		values.push(updates.lastMessageAt);
	}
	if (sets.length === 0) return;
	sets.push("updated_at = ?");
	values.push(DateTime.now().toISO());
	values.push(id);
	await db
		.prepare(`UPDATE chats SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

/** 友だちからメッセージ受信時にチャットを作成/更新 */
export async function upsertChatOnMessage(db: D1Database, friendId: string): Promise<ChatRow> {
	const existing = await getChatByFriendId(db, friendId);
	const now = DateTime.now().toISO();
	if (existing) {
		// resolvedだった場合はunreadに戻す
		const newStatus = existing.status === "resolved" ? "unread" : existing.status;
		await updateChat(db, existing.id, { status: newStatus, lastMessageAt: now });
		const updated = await getChatById(db, existing.id);
		if (!updated) throw new Error(`Failed to retrieve chat after update: ${existing.id}`);
		return updated;
	}
	return createChat(db, { friendId });
}

// --- グループ/ルームチャット ---

/** グループ/ルームIDでチャットを検索 */
export async function getChatByGroupId(db: D1Database, groupId: string): Promise<ChatRow | null> {
	return db
		.prepare("SELECT * FROM chats WHERE (group_id = ? OR room_id = ?) ORDER BY created_at DESC LIMIT 1")
		.bind(groupId, groupId)
		.first<ChatRow>();
}

/** ボットがグループ/ルームに参加した際にチャットレコードを作成/更新 */
export async function upsertGroupChat(db: D1Database, input: UpsertGroupChatInput): Promise<ChatRow> {
	const existing = await getChatByGroupId(db, input.groupId);
	const now = DateTime.now().toISO();

	if (existing) {
		const sets: string[] = [
			"group_name = ?",
			"group_picture_url = ?",
			"source_type = ?",
			"status = ?",
			"updated_at = ?",
		];
		const values = [input.groupName, input.groupPictureUrl, input.sourceType, "unread", now, existing.id];
		await db
			.prepare(`UPDATE chats SET ${sets.join(", ")} WHERE id = ?`)
			.bind(...values)
			.run();
		const updated = await getChatById(db, existing.id);
		if (!updated) throw new Error(`Failed to retrieve chat after update: ${existing.id}`);
		return updated;
	}

	const id = crypto.randomUUID();
	const groupIdCol = input.sourceType === "group" ? "group_id" : "room_id";
	await db
		.prepare(
			`INSERT INTO chats (id, source_type, ${groupIdCol}, group_name, group_picture_url, status, last_message_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'unread', ?, ?, ?)`,
		)
		.bind(id, input.sourceType, input.groupId, input.groupName, input.groupPictureUrl, now, now, now)
		.run();
	const created = await getChatById(db, id);
	if (!created) throw new Error(`Failed to retrieve chat after insert: ${id}`);
	return created;
}

/** グループチャットでメッセージ受信時にチャットを更新 */
export async function upsertGroupChatOnMessage(
	db: D1Database,
	groupId: string,
	sourceType: "group" | "room",
): Promise<ChatRow> {
	const existing = await getChatByGroupId(db, groupId);
	const now = DateTime.now().toISO();

	if (existing) {
		const newStatus = existing.status === "resolved" ? "unread" : existing.status;
		await updateChat(db, existing.id, { status: newStatus, lastMessageAt: now });
		const updated = await getChatById(db, existing.id);
		if (!updated) throw new Error(`Failed to retrieve chat after update: ${existing.id}`);
		return updated;
	}

	// Group chat record does not exist yet (bot may not have received join event)
	const id = crypto.randomUUID();
	const groupIdCol = sourceType === "group" ? "group_id" : "room_id";
	await db
		.prepare(
			`INSERT INTO chats (id, source_type, ${groupIdCol}, group_name, status, last_message_at, created_at, updated_at)
     VALUES (?, ?, ?, 'Unknown Group', 'unread', ?, ?, ?)`,
		)
		.bind(id, sourceType, groupId, now, now, now)
		.run();
	const created = await getChatById(db, id);
	if (!created) throw new Error(`Failed to retrieve chat after insert: ${id}`);
	return created;
}

/** ボットがグループ/ルームから退出した際にチャットを非アクティブにする */
export async function deactivateGroupChat(db: D1Database, groupId: string): Promise<void> {
	const now = DateTime.now().toISO();
	await db
		.prepare(`UPDATE chats SET status = 'resolved', updated_at = ? WHERE (group_id = ? OR room_id = ?)`)
		.bind(now, groupId, groupId)
		.run();
}
