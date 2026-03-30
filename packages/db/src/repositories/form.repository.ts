// =============================================================================
// Form Repository - Drizzle ORM
// =============================================================================

import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { formSubmissions, forms } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createFormRepository(db: Database) {
	return {
		/** List all forms, newest first */
		async list() {
			return db.select().from(forms).orderBy(desc(forms.createdAt));
		},

		/** Find a form by ID */
		async findById(id: string) {
			const [row] = await db.select().from(forms).where(eq(forms.id, id));
			return row ?? null;
		},

		/** Create a new form, returns the generated ID */
		async create(data: {
			name: string;
			description?: string | null;
			fields: string;
			onSubmitTagId?: string | null;
			onSubmitScenarioId?: string | null;
			saveToMetadata?: boolean;
		}): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(forms).values({
				id,
				name: data.name,
				description: data.description ?? null,
				fields: data.fields,
				onSubmitTagId: data.onSubmitTagId ?? null,
				onSubmitScenarioId: data.onSubmitScenarioId ?? null,
				saveToMetadata: data.saveToMetadata !== false,
			});
			return id;
		},

		/** Partial update of a form */
		async update(
			id: string,
			updates: Partial<{
				name: string;
				description: string | null;
				fields: string;
				onSubmitTagId: string | null;
				onSubmitScenarioId: string | null;
				saveToMetadata: boolean;
				isActive: boolean;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.description !== undefined) setClause.description = updates.description;
			if (updates.fields !== undefined) setClause.fields = updates.fields;
			if (updates.onSubmitTagId !== undefined) setClause.onSubmitTagId = updates.onSubmitTagId;
			if (updates.onSubmitScenarioId !== undefined) setClause.onSubmitScenarioId = updates.onSubmitScenarioId;
			if (updates.saveToMetadata !== undefined) setClause.saveToMetadata = updates.saveToMetadata;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(forms).set(setClause).where(eq(forms.id, id));
		},

		/** Hard-delete a form */
		async delete(id: string): Promise<void> {
			await db.delete(forms).where(eq(forms.id, id));
		},

		/** Get all submissions for a form, newest first */
		async getSubmissions(formId: string) {
			return db
				.select()
				.from(formSubmissions)
				.where(eq(formSubmissions.formId, formId))
				.orderBy(desc(formSubmissions.createdAt));
		},

		/** Create a form submission and increment submit_count */
		async createSubmission(data: { formId: string; friendId?: string | null; data: string }): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(formSubmissions).values({
				id,
				formId: data.formId,
				friendId: data.friendId ?? null,
				data: data.data,
			});

			// Increment submit_count on the parent form
			await db
				.update(forms)
				.set({
					submitCount: sql`${forms.submitCount} + 1`,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(forms.id, data.formId));

			return id;
		},
	};
}
