// =============================================================================
// Calendar Repository - Drizzle ORM (Google Calendar integration)
// =============================================================================

import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { calendarBookings, googleCalendarConnections } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createCalendarRepository(db: Database) {
	return {
		// --- Connections ---

		async listConnections() {
			return db.select().from(googleCalendarConnections).orderBy(desc(googleCalendarConnections.createdAt));
		},

		async findConnectionById(id: string) {
			const [row] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.id, id));
			return row ?? null;
		},

		async createConnection(input: {
			calendarId: string;
			authType: string;
			accessToken?: string;
			refreshToken?: string;
			apiKey?: string;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(googleCalendarConnections).values({
				id,
				calendarId: input.calendarId,
				authType: input.authType,
				accessToken: input.accessToken ?? null,
				refreshToken: input.refreshToken ?? null,
				apiKey: input.apiKey ?? null,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findConnectionById(id);
			if (!created) throw new Error(`Failed to retrieve calendar connection after insert: ${id}`);
			return created;
		},

		async updateTokens(id: string, tokens: { accessToken: string; tokenExpiresAt: string }) {
			await db
				.update(googleCalendarConnections)
				.set({
					accessToken: tokens.accessToken,
					tokenExpiresAt: tokens.tokenExpiresAt,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(googleCalendarConnections.id, id));
		},

		async deleteConnection(id: string) {
			await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.id, id));
		},

		// --- Bookings ---

		async listBookings(opts: { connectionId?: string; friendId?: string } = {}) {
			if (opts.friendId) {
				return db
					.select()
					.from(calendarBookings)
					.where(eq(calendarBookings.friendId, opts.friendId))
					.orderBy(asc(calendarBookings.startAt));
			}
			if (opts.connectionId) {
				return db
					.select()
					.from(calendarBookings)
					.where(eq(calendarBookings.connectionId, opts.connectionId))
					.orderBy(asc(calendarBookings.startAt));
			}
			return db.select().from(calendarBookings).orderBy(asc(calendarBookings.startAt));
		},

		async findBookingById(id: string) {
			const [row] = await db.select().from(calendarBookings).where(eq(calendarBookings.id, id));
			return row ?? null;
		},

		async createBooking(input: {
			connectionId: string;
			friendId?: string;
			eventId?: string;
			title: string;
			startAt: string;
			endAt: string;
			metadata?: string;
		}) {
			const id = crypto.randomUUID();
			const now = DateTime.now().toISO();
			await db.insert(calendarBookings).values({
				id,
				connectionId: input.connectionId,
				friendId: input.friendId ?? null,
				eventId: input.eventId ?? null,
				title: input.title,
				startAt: input.startAt,
				endAt: input.endAt,
				metadata: input.metadata ?? null,
				createdAt: now,
				updatedAt: now,
			});
			const created = await this.findBookingById(id);
			if (!created) throw new Error(`Failed to retrieve calendar booking after insert: ${id}`);
			return created;
		},

		async updateBookingStatus(id: string, status: string) {
			await db
				.update(calendarBookings)
				.set({ status, updatedAt: DateTime.now().toISO() })
				.where(eq(calendarBookings.id, id));
		},

		async updateBookingEventId(id: string, eventId: string) {
			await db
				.update(calendarBookings)
				.set({ eventId, updatedAt: DateTime.now().toISO() })
				.where(eq(calendarBookings.id, id));
		},

		/** Get bookings in a date range for availability calculation */
		async getBookingsInRange(connectionId: string, startAt: string, endAt: string) {
			return db
				.select()
				.from(calendarBookings)
				.where(
					and(
						eq(calendarBookings.connectionId, connectionId),
						gte(calendarBookings.startAt, startAt),
						lte(calendarBookings.endAt, endAt),
						ne(calendarBookings.status, "cancelled"),
					),
				)
				.orderBy(asc(calendarBookings.startAt));
		},
	};
}
