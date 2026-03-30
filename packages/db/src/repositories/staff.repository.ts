// =============================================================================
// Staff Repository - Drizzle ORM
// =============================================================================

import type { StaffId } from "@line-crm/domain";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { staffMembers } from "../schema/index.js";
import { DateTime } from "../utils.js";

function generateApiKey(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `lh_${hex}`;
}

export function createStaffRepository(db: Database) {
	return {
		/** List all staff members, oldest first */
		async list() {
			return db.select().from(staffMembers).orderBy(asc(staffMembers.createdAt));
		},

		/** Find a staff member by ID */
		async findById(id: StaffId) {
			const [row] = await db.select().from(staffMembers).where(eq(staffMembers.id, id));
			return row ?? null;
		},

		/** Find an active staff member by API key */
		async findByApiKey(apiKey: string) {
			const [row] = await db
				.select()
				.from(staffMembers)
				.where(and(eq(staffMembers.apiKey, apiKey), eq(staffMembers.isActive, true)));
			return row ?? null;
		},

		/** Create a new staff member with auto-generated API key, returns the generated ID */
		async create(data: { name: string; email?: string | null; role: "owner" | "admin" | "staff" }): Promise<string> {
			const id = crypto.randomUUID();
			const apiKey = generateApiKey();
			await db.insert(staffMembers).values({
				id,
				name: data.name,
				email: data.email ?? null,
				role: data.role,
				apiKey,
			});
			return id;
		},

		/** Partial update of a staff member */
		async update(
			id: StaffId,
			updates: Partial<{
				name: string;
				email: string | null;
				role: "owner" | "admin" | "staff";
				isActive: boolean;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.email !== undefined) setClause.email = updates.email;
			if (updates.role !== undefined) setClause.role = updates.role;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(staffMembers).set(setClause).where(eq(staffMembers.id, id));
		},

		/** Hard-delete a staff member */
		async delete(id: StaffId): Promise<void> {
			await db.delete(staffMembers).where(eq(staffMembers.id, id));
		},

		/** Regenerate API key for a staff member, returns the new key */
		async regenerateApiKey(id: StaffId): Promise<string> {
			const newKey = generateApiKey();
			await db
				.update(staffMembers)
				.set({ apiKey: newKey, updatedAt: DateTime.now().toISO() })
				.where(eq(staffMembers.id, id));
			return newKey;
		},

		/** Count staff members by role */
		async countByRole(role: string): Promise<number> {
			const result = await db
				.select({ count: sql<number>`count(*)` })
				.from(staffMembers)
				.where(eq(staffMembers.role, role));
			return result[0]?.count ?? 0;
		},
	};
}
