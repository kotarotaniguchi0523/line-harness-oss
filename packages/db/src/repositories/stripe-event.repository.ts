// =============================================================================
// Stripe Event Repository - Drizzle ORM
// =============================================================================

import { desc, eq } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { stripeEvents } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createStripeEventRepository(db: Database) {
	return {
		async list(opts: { friendId?: string; eventType?: string; limit?: number } = {}) {
			const limit = opts.limit ?? 100;
			if (opts.friendId) {
				return db
					.select()
					.from(stripeEvents)
					.where(eq(stripeEvents.friendId, opts.friendId))
					.orderBy(desc(stripeEvents.processedAt))
					.limit(limit);
			}
			if (opts.eventType) {
				return db
					.select()
					.from(stripeEvents)
					.where(eq(stripeEvents.eventType, opts.eventType))
					.orderBy(desc(stripeEvents.processedAt))
					.limit(limit);
			}
			return db.select().from(stripeEvents).orderBy(desc(stripeEvents.processedAt)).limit(limit);
		},

		async findByStripeId(stripeEventId: string) {
			const [row] = await db.select().from(stripeEvents).where(eq(stripeEvents.stripeEventId, stripeEventId));
			return row ?? null;
		},

		async create(input: {
			stripeEventId: string;
			eventType: string;
			friendId?: string;
			amount?: number;
			currency?: string;
			metadata?: string;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(stripeEvents).values({
				id,
				stripeEventId: input.stripeEventId,
				eventType: input.eventType,
				friendId: input.friendId ?? null,
				amount: input.amount ?? null,
				currency: input.currency ?? null,
				metadata: input.metadata ?? null,
				processedAt: now,
			});
			const [created] = await db.select().from(stripeEvents).where(eq(stripeEvents.id, id));
			if (!created) throw new Error(`Failed to retrieve stripe event after insert: ${id}`);
			return created;
		},
	};
}
