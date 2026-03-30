// =============================================================================
// LINE Account Repository - Drizzle ORM
// =============================================================================

import type { ChannelId, LineAccountId } from "@line-crm/domain";
import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { lineAccounts } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createLineAccountRepository(db: Database) {
	return {
		/** List all LINE accounts, newest first */
		async list() {
			return db.select().from(lineAccounts).orderBy(desc(lineAccounts.createdAt));
		},

		/** Find a LINE account by ID */
		async findById(id: LineAccountId) {
			const [row] = await db.select().from(lineAccounts).where(eq(lineAccounts.id, id));
			return row ?? null;
		},

		/** Find a LINE account by channel ID */
		async findByChannelId(channelId: ChannelId | string) {
			const [row] = await db
				.select()
				.from(lineAccounts)
				.where(eq(lineAccounts.channelId, channelId as string));
			return row ?? null;
		},

		/** Create a new LINE account, returns the generated ID */
		async create(data: {
			channelId: string;
			name: string;
			channelAccessToken: string;
			channelSecret: string;
		}): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(lineAccounts).values({
				id,
				channelId: data.channelId,
				name: data.name,
				channelAccessToken: data.channelAccessToken,
				channelSecret: data.channelSecret,
			});
			return id;
		},

		/** Partial update of a LINE account */
		async update(
			id: LineAccountId,
			updates: Partial<{
				name: string;
				channelAccessToken: string;
				channelSecret: string;
				isActive: boolean;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.channelAccessToken !== undefined) setClause.channelAccessToken = updates.channelAccessToken;
			if (updates.channelSecret !== undefined) setClause.channelSecret = updates.channelSecret;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(lineAccounts).set(setClause).where(eq(lineAccounts.id, id));
		},

		/** Hard-delete a LINE account */
		async delete(id: LineAccountId): Promise<void> {
			await db.delete(lineAccounts).where(eq(lineAccounts.id, id));
		},
	};
}
