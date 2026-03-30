import {
	type ConnectCalendarRequest,
	ConnectCalendarSchema,
	type CreateBookingRequest,
	CreateBookingSchema,
	MIDDLEWARE_LIMITS,
	type UpdateBookingStatusRequest,
	UpdateBookingStatusSchema,
} from "@line-crm/contracts";
import { createCalendarRepository, DateTime } from "@line-crm/db";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import type { Env } from "../index.js";
import { validateJson } from "../middleware/validate.js";
import { ensureValidAccessToken, GoogleCalendarClient } from "../services/google-calendar.js";

const calendar = new Hono<Env>();

// Apply timeout to all calendar routes (calls Google API)
calendar.use("*", timeout(MIDDLEWARE_LIMITS.externalApiTimeoutMs));

// ========== 接続管理 ==========

calendar.get("/api/integrations/google-calendar", async (c) => {
	try {
		const db = c.get("db");
		const calendarRepo = createCalendarRepository(db);
		const items = await calendarRepo.listConnections();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/integrations/google-calendar error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.post("/api/integrations/google-calendar/connect", validateJson(ConnectCalendarSchema), async (c) => {
	try {
		const body: ConnectCalendarRequest = c.req.valid("json");
		const db = c.get("db");
		const calendarRepo = createCalendarRepository(db);
		const id = await calendarRepo.createConnection(body);
		const conn = await calendarRepo.findConnectionById(id);
		return c.json({ success: true, data: conn }, 201);
	} catch (err) {
		console.error("POST /api/integrations/google-calendar/connect error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.delete("/api/integrations/google-calendar/:id", async (c) => {
	try {
		const db = c.get("db");
		const calendarRepo = createCalendarRepository(db);
		await calendarRepo.deleteConnection(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/integrations/google-calendar/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 空きスロット取得 ==========

calendar.get("/api/integrations/google-calendar/slots", async (c) => {
	try {
		const connectionId = c.req.query("connectionId");
		const date = c.req.query("date"); // YYYY-MM-DD
		const slotMinutes = Number(c.req.query("slotMinutes") ?? "60");
		const startHour = Number(c.req.query("startHour") ?? "9");
		const endHour = Number(c.req.query("endHour") ?? "18");

		if (!(connectionId && date)) {
			return c.json({ success: false, error: "connectionId and date are required" }, 400);
		}

		const db = c.get("db");
		const calendarRepo = createCalendarRepository(db);
		const conn = await calendarRepo.findConnectionById(connectionId);
		if (!conn) {
			return c.json({ success: false, error: "Calendar connection not found" }, 404);
		}

		const dayStart = `${date}T${String(startHour).padStart(2, "0")}:00:00`;
		const dayEnd = `${date}T${String(endHour).padStart(2, "0")}:00:00`;

		// 既存D1予約を取得
		const bookings = await calendarRepo.getBookingsInRange(connectionId, dayStart, dayEnd);

		// Google FreeBusy API から busy 区間を取得（access_token がある場合のみ）
		let googleBusyIntervals: { start: string; end: string }[] = [];
		const validToken = await ensureValidAccessToken(c.env.DB, conn, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET);
		if (validToken) {
			try {
				const gcal = new GoogleCalendarClient({
					calendarId: (conn as unknown as Record<string, unknown>).calendarId as string,
					accessToken: validToken,
				});
				const timeMin = `${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`;
				const timeMax = `${date}T${String(endHour).padStart(2, "0")}:00:00+09:00`;
				googleBusyIntervals = await gcal.getFreeBusy(timeMin, timeMax);
			} catch (err) {
				console.warn("Google FreeBusy API error (falling back to D1 only):", err);
			}
		}

		// スロットを生成して空きを計算
		const slots: { startAt: string; endAt: string; available: boolean }[] = [];
		const baseDate = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`);

		for (let h = startHour; h < endHour; h += slotMinutes / 60) {
			const slotStart = new Date(baseDate);
			slotStart.setMinutes(slotStart.getMinutes() + (h - startHour) * 60);
			const slotEnd = new Date(slotStart);
			slotEnd.setMinutes(slotEnd.getMinutes() + slotMinutes);

			const startStr = DateTime.fromDate(slotStart).toISO();
			const endStr = DateTime.fromDate(slotEnd).toISO();

			const isBookedInD1 = bookings.some((b: Record<string, unknown>) => {
				const bStart = new Date((b.start_at as string) ?? (b.startAt as string)).getTime();
				const bEnd = new Date((b.end_at as string) ?? (b.endAt as string)).getTime();
				return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
			});

			const isBookedInGoogle = googleBusyIntervals.some((interval) => {
				const gStart = new Date(interval.start).getTime();
				const gEnd = new Date(interval.end).getTime();
				return slotStart.getTime() < gEnd && slotEnd.getTime() > gStart;
			});

			slots.push({ startAt: startStr, endAt: endStr, available: !(isBookedInD1 || isBookedInGoogle) });
		}

		return c.json({ success: true, data: slots });
	} catch (err) {
		console.error("GET /api/integrations/google-calendar/slots error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 予約管理 ==========

calendar.get("/api/integrations/google-calendar/bookings", async (c) => {
	try {
		const connectionId = c.req.query("connectionId");
		const friendId = c.req.query("friendId");
		const db = c.get("db");
		const calendarRepo = createCalendarRepository(db);
		const items = await calendarRepo.listBookings({
			connectionId: connectionId ?? undefined,
			friendId: friendId ?? undefined,
		});
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/integrations/google-calendar/bookings error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.post("/api/integrations/google-calendar/book", validateJson(CreateBookingSchema), async (c) => {
	try {
		const body: CreateBookingRequest = c.req.valid("json");

		const db = c.get("db");
		const calendarRepo = createCalendarRepository(db);

		// D1 に予約レコードを作成
		const bookingId = await calendarRepo.createBooking({
			...body,
			metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
		});

		let eventId: string | null = null;

		// Google Calendar にイベントを作成（ベストエフォート）
		const conn = await calendarRepo.findConnectionById(body.connectionId);
		const bookingToken = conn
			? await ensureValidAccessToken(c.env.DB, conn, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET)
			: null;
		if (conn && bookingToken) {
			try {
				const gcal = new GoogleCalendarClient({
					calendarId: (conn as unknown as Record<string, unknown>).calendarId as string,
					accessToken: bookingToken,
				});
				const result = await gcal.createEvent({
					summary: body.title,
					start: body.startAt,
					end: body.endAt,
					description: body.description,
				});
				eventId = result.eventId;
				await calendarRepo.updateBookingEventId(bookingId, eventId);
			} catch (err) {
				console.warn("Google Calendar createEvent error (booking still created in D1):", err);
			}
		}

		const booking = await calendarRepo.findBookingById(bookingId);
		return c.json({ success: true, data: booking }, 201);
	} catch (err) {
		console.error("POST /api/integrations/google-calendar/book error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.put(
	"/api/integrations/google-calendar/bookings/:id/status",
	validateJson(UpdateBookingStatusSchema),
	async (c) => {
		try {
			const id = c.req.param("id");
			const { status }: UpdateBookingStatusRequest = c.req.valid("json");

			const db = c.get("db");
			const calendarRepo = createCalendarRepository(db);

			// キャンセル時は Google Calendar のイベントも削除する（ベストエフォート）
			if (status === "cancelled") {
				const booking = await calendarRepo.findBookingById(id);
				const bookingRecord = booking as unknown as Record<string, unknown>;
				if (bookingRecord?.event_id && bookingRecord?.connection_id) {
					const conn = await calendarRepo.findConnectionById(bookingRecord.connection_id as string);
					const cancelToken = conn
						? await ensureValidAccessToken(c.env.DB, conn, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET)
						: null;
					if (conn && cancelToken) {
						try {
							const gcal = new GoogleCalendarClient({
								calendarId: (conn as unknown as Record<string, unknown>).calendarId as string,
								accessToken: cancelToken,
							});
							await gcal.deleteEvent(bookingRecord.event_id as string);
						} catch (err) {
							console.warn("Google Calendar deleteEvent error (status still updated in D1):", err);
						}
					}
				}
			}

			await calendarRepo.updateBookingStatus(id, status);
			return c.json({ success: true, data: null });
		} catch (err) {
			console.error("PUT /api/integrations/google-calendar/bookings/:id/status error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { calendar };
