// =============================================================================
// Webhook Config Repository - Drizzle ORM
// =============================================================================

import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { incomingWebhooks, outgoingWebhooks } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createWebhookConfigRepository(db: Database) {
	return {
		// --- Incoming Webhooks ---

		async listIncoming() {
			return db.select().from(incomingWebhooks).orderBy(desc(incomingWebhooks.createdAt));
		},

		async findIncomingById(id: string) {
			const [row] = await db.select().from(incomingWebhooks).where(eq(incomingWebhooks.id, id));
			return row ?? null;
		},

		async createIncoming(input: { name: string; sourceType?: string; secret?: string }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(incomingWebhooks).values({
				id,
				name: input.name,
				sourceType: input.sourceType ?? "custom",
				secret: input.secret ?? null,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findIncomingById(id);
			if (!created) throw new Error(`Failed to retrieve incoming webhook after insert: ${id}`);
			return created;
		},

		async updateIncoming(
			id: string,
			updates: Partial<{ name: string; sourceType: string; secret: string; isActive: boolean }>,
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (updates.name !== undefined) set.name = updates.name;
			if (updates.sourceType !== undefined) set.sourceType = updates.sourceType;
			if (updates.secret !== undefined) set.secret = updates.secret;
			if (updates.isActive !== undefined) set.isActive = updates.isActive;

			await db.update(incomingWebhooks).set(set).where(eq(incomingWebhooks.id, id));
		},

		async deleteIncoming(id: string) {
			await db.delete(incomingWebhooks).where(eq(incomingWebhooks.id, id));
		},

		// --- Outgoing Webhooks ---

		async listOutgoing() {
			return db.select().from(outgoingWebhooks).orderBy(desc(outgoingWebhooks.createdAt));
		},

		async findOutgoingById(id: string) {
			const [row] = await db.select().from(outgoingWebhooks).where(eq(outgoingWebhooks.id, id));
			return row ?? null;
		},

		async createOutgoing(input: { name: string; url: string; eventTypes: string[]; secret?: string }) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(outgoingWebhooks).values({
				id,
				name: input.name,
				url: input.url,
				eventTypes: JSON.stringify(input.eventTypes),
				secret: input.secret ?? null,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findOutgoingById(id);
			if (!created) throw new Error(`Failed to retrieve outgoing webhook after insert: ${id}`);
			return created;
		},

		async updateOutgoing(
			id: string,
			updates: Partial<{ name: string; url: string; eventTypes: string[]; secret: string; isActive: boolean }>,
		) {
			const set: Record<string, unknown> = { updatedAt: DateTime.now().toISO() };
			if (updates.name !== undefined) set.name = updates.name;
			if (updates.url !== undefined) set.url = updates.url;
			if (updates.eventTypes !== undefined) set.eventTypes = JSON.stringify(updates.eventTypes);
			if (updates.secret !== undefined) set.secret = updates.secret;
			if (updates.isActive !== undefined) set.isActive = updates.isActive;

			await db.update(outgoingWebhooks).set(set).where(eq(outgoingWebhooks.id, id));
		},

		async deleteOutgoing(id: string) {
			await db.delete(outgoingWebhooks).where(eq(outgoingWebhooks.id, id));
		},

		/** Find active outgoing webhooks matching a given event type */
		async findActiveByEvent(eventType: string) {
			const all = await db.select().from(outgoingWebhooks).where(eq(outgoingWebhooks.isActive, true));
			return all.filter((w) => {
				const types: string[] = JSON.parse(w.eventTypes);
				return types.includes(eventType) || types.includes("*");
			});
		},
	};
}
