import { DateTime } from "./utils.js";
export interface Friend {
	id: string;
	line_user_id: string;
	display_name: string | null;
	picture_url: string | null;
	status_message: string | null;
	is_following: number;
	user_id: string | null;
	line_account_id: string | null;
	metadata: string;
	created_at: string;
	updated_at: string;
}

export interface GetFriendsOptions {
	limit?: number;
	offset?: number;
	tagId?: string;
}

export async function getFriends(db: D1Database, opts: GetFriendsOptions = {}): Promise<Friend[]> {
	const { limit = 50, offset = 0, tagId } = opts;

	if (tagId) {
		const result = await db
			.prepare(
				`SELECT f.id, f.line_user_id, f.display_name, f.picture_url, f.status_message,
                f.is_following, f.user_id, f.line_account_id, f.metadata, f.created_at, f.updated_at
         FROM friends f
         INNER JOIN friend_tags ft ON ft.friend_id = f.id
         WHERE ft.tag_id = ? AND f.deleted_at IS NULL
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
			)
			.bind(tagId, limit, offset)
			.all<Friend>();
		return result.results;
	}

	const result = await db
		.prepare(
			`SELECT id, line_user_id, display_name, picture_url, status_message,
              is_following, user_id, line_account_id, metadata, created_at, updated_at
       FROM friends
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
		)
		.bind(limit, offset)
		.all<Friend>();
	return result.results;
}

export async function getFriendByLineUserId(db: D1Database, lineUserId: string): Promise<Friend | null> {
	return db
		.prepare(
			`SELECT id, line_user_id, display_name, picture_url, status_message,
              is_following, user_id, line_account_id, metadata, created_at, updated_at
       FROM friends
       WHERE line_user_id = ? AND deleted_at IS NULL`,
		)
		.bind(lineUserId)
		.first<Friend>();
}

export async function getFriendById(db: D1Database, id: string): Promise<Friend | null> {
	return db
		.prepare(
			`SELECT id, line_user_id, display_name, picture_url, status_message,
              is_following, user_id, line_account_id, metadata, created_at, updated_at
       FROM friends
       WHERE id = ? AND deleted_at IS NULL`,
		)
		.bind(id)
		.first<Friend>();
}

export interface UpsertFriendInput {
	lineUserId: string;
	displayName?: string | null;
	pictureUrl?: string | null;
	statusMessage?: string | null;
}

export async function upsertFriend(db: D1Database, input: UpsertFriendInput): Promise<Friend> {
	const now = DateTime.now().toISO();
	const existing = await getFriendByLineUserId(db, input.lineUserId);

	if (existing) {
		await db
			.prepare(
				`UPDATE friends
         SET display_name = ?,
             picture_url = ?,
             status_message = ?,
             is_following = 1,
             updated_at = ?
         WHERE line_user_id = ?`,
			)
			.bind(
				"displayName" in input ? (input.displayName ?? null) : existing.display_name,
				"pictureUrl" in input ? (input.pictureUrl ?? null) : existing.picture_url,
				"statusMessage" in input ? (input.statusMessage ?? null) : existing.status_message,
				now,
				input.lineUserId,
			)
			.run();

		const updated = await getFriendByLineUserId(db, input.lineUserId);
		if (!updated) throw new Error(`Failed to retrieve friend after upsert: ${input.lineUserId}`);
		return updated;
	}

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO friends (id, line_user_id, display_name, picture_url, status_message, is_following, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
		)
		.bind(
			id,
			input.lineUserId,
			input.displayName ?? null,
			input.pictureUrl ?? null,
			input.statusMessage ?? null,
			now,
			now,
		)
		.run();

	const created = await getFriendById(db, id);
	if (!created) throw new Error(`Failed to retrieve friend after insert: ${id}`);
	return created;
}

export async function updateFriendFollowStatus(
	db: D1Database,
	lineUserId: string,
	isFollowing: boolean,
): Promise<void> {
	await db
		.prepare(
			`UPDATE friends
       SET is_following = ?, updated_at = ?
       WHERE line_user_id = ?`,
		)
		.bind(isFollowing ? 1 : 0, DateTime.now().toISO(), lineUserId)
		.run();
}

export async function getFriendCount(db: D1Database): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) as count FROM friends WHERE deleted_at IS NULL")
		.first<{ count: number }>();
	return row?.count ?? 0;
}
