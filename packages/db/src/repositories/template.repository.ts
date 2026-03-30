// =============================================================================
// Template Repository - Drizzle ORM
// =============================================================================

import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { templates } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createTemplateRepository(db: Database) {
	return {
		async list(category?: string) {
			if (category) {
				return db.select().from(templates).where(eq(templates.category, category)).orderBy(desc(templates.createdAt));
			}
			return db.select().from(templates).orderBy(desc(templates.createdAt));
		},

		async findById(id: string) {
			const [row] = await db.select().from(templates).where(eq(templates.id, id));
			return row ?? null;
		},

		async create(input: { name: string; category?: string; messageType: string; messageContent: string }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(templates).values({
				id,
				name: input.name,
				category: input.category ?? "general",
				messageType: input.messageType,
				messageContent: input.messageContent,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findById(id);
			if (!created) throw new Error(`Failed to retrieve template after insert: ${id}`);
			return created;
		},

		async update(
			id: string,
			updates: Partial<{ name: string; category: string; messageType: string; messageContent: string }>,
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (updates.name !== undefined) set.name = updates.name;
			if (updates.category !== undefined) set.category = updates.category;
			if (updates.messageType !== undefined) set.messageType = updates.messageType;
			if (updates.messageContent !== undefined) set.messageContent = updates.messageContent;

			await db.update(templates).set(set).where(eq(templates.id, id));
		},

		async delete(id: string) {
			await db.delete(templates).where(eq(templates.id, id));
		},
	};
}
