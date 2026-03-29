import { DateTime } from "./utils.js";
// テンプレート管理クエリヘルパー

export interface TemplateRow {
	id: string;
	name: string;
	category: string;
	message_type: string;
	message_content: string;
	created_at: string;
	updated_at: string;
}

export async function getTemplates(db: D1Database, category?: string): Promise<TemplateRow[]> {
	if (category) {
		const result = await db
			.prepare("SELECT * FROM templates WHERE category = ? ORDER BY created_at DESC")
			.bind(category)
			.all<TemplateRow>();
		return result.results;
	}
	const result = await db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all<TemplateRow>();
	return result.results;
}

export async function getTemplateById(db: D1Database, id: string): Promise<TemplateRow | null> {
	return db.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first<TemplateRow>();
}

export async function createTemplate(
	db: D1Database,
	input: { name: string; category?: string; messageType: string; messageContent: string },
): Promise<TemplateRow> {
	const id = crypto.randomUUID();
	const now = DateTime.now().toISO();
	await db
		.prepare(
			"INSERT INTO templates (id, name, category, message_type, message_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(id, input.name, input.category ?? "general", input.messageType, input.messageContent, now, now)
		.run();
	const created = await getTemplateById(db, id);
	if (!created) throw new Error(`Failed to retrieve template after insert: ${id}`);
	return created;
}

export async function updateTemplate(
	db: D1Database,
	id: string,
	updates: Partial<{ name: string; category: string; messageType: string; messageContent: string }>,
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];
	if (updates.name !== undefined) {
		sets.push("name = ?");
		values.push(updates.name);
	}
	if (updates.category !== undefined) {
		sets.push("category = ?");
		values.push(updates.category);
	}
	if (updates.messageType !== undefined) {
		sets.push("message_type = ?");
		values.push(updates.messageType);
	}
	if (updates.messageContent !== undefined) {
		sets.push("message_content = ?");
		values.push(updates.messageContent);
	}
	if (sets.length === 0) return;
	sets.push("updated_at = ?");
	values.push(DateTime.now().toISO());
	values.push(id);
	await db
		.prepare(`UPDATE templates SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function deleteTemplate(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
}
