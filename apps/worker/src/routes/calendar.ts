import {
	type ConnectCalendarRequest,
	ConnectCalendarSchema,
	type CreateBookingRequest,
	CreateBookingSchema,
	MIDDLEWARE_LIMITS,
	type UpdateBookingStatusRequest,
	UpdateBookingStatusSchema,
} from "@line-crm/contracts";
import {
	createCalendarBooking,
	createCalendarConnection,
	DateTime,
	deleteCalendarConnection,
	getBookingsInRange,
	getCalendarBookingById,
	getCalendarBookings,
	getCalendarConnectionById,
	getCalendarConnections,
	updateCalendarBookingEventId,
	updateCalendarBookingStatus,
} from "@line-crm/db";
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
		const items = await getCalendarConnections(c.env.DB);
		return c.json({
			success: true,
			data: items.map((conn) => ({
				id: conn.id,
				calendarId: conn.calendar_id,
				authType: conn.auth_type,
				isActive: Boolean(conn.is_active),
				createdAt: conn.created_at,
				updatedAt: conn.updated_at,
			})),
		});
	} catch (err) {
		console.error("GET /api/integrations/google-calendar error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.post("/api/integrations/google-calendar/connect", validateJson(ConnectCalendarSchema), async (c) => {
	try {
		const body: ConnectCalendarRequest = c.req.valid("json");
		const conn = await createCalendarConnection(c.env.DB, body);
		return c.json(
			{
				success: true,
				data: {
					id: conn.id,
					calendarId: conn.calendar_id,
					authType: conn.auth_type,
					isActive: Boolean(conn.is_active),
					createdAt: conn.created_at,
				},
			},
			201,
		);
	} catch (err) {
		console.error("POST /api/integrations/google-calendar/connect error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.delete("/api/integrations/google-calendar/:id", async (c) => {
	try {
		await deleteCalendarConnection(c.env.DB, c.req.param("id"));
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

		const conn = await getCalendarConnectionById(c.env.DB, connectionId);
		if (!conn) {
			return c.json({ success: false, error: "Calendar connection not found" }, 404);
		}

		const dayStart = `${date}T${String(startHour).padStart(2, "0")}:00:00`;
		const dayEnd = `${date}T${String(endHour).padStart(2, "0")}:00:00`;

		// 既存D1予約を取得
		const bookings = await getBookingsInRange(c.env.DB, connectionId, dayStart, dayEnd);

		// Google FreeBusy API から busy 区間を取得（access_token がある場合のみ）
		let googleBusyIntervals: { start: string; end: string }[] = [];
		const validToken = await ensureValidAccessToken(c.env.DB, conn, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET);
		if (validToken) {
			try {
				const gcal = new GoogleCalendarClient({
					calendarId: conn.calendar_id,
					accessToken: validToken,
				});
				// タイムゾーンオフセットを付けて ISO 形式で渡す（Asia/Tokyo = +09:00）
				const timeMin = `${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`;
				const timeMax = `${date}T${String(endHour).padStart(2, "0")}:00:00+09:00`;
				googleBusyIntervals = await gcal.getFreeBusy(timeMin, timeMax);
			} catch (err) {
				// Google API 失敗はベストエフォート — D1 のみでフォールバック
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

			// D1 予約との重複チェック
			const isBookedInD1 = bookings.some((b) => {
				const bStart = new Date(b.start_at).getTime();
				const bEnd = new Date(b.end_at).getTime();
				return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
			});

			// Google busy 区間との重複チェック
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
		const items = await getCalendarBookings(c.env.DB, {
			connectionId: connectionId ?? undefined,
			friendId: friendId ?? undefined,
		});
		return c.json({
			success: true,
			data: items.map((b) => ({
				id: b.id,
				connectionId: b.connection_id,
				friendId: b.friend_id,
				eventId: b.event_id,
				title: b.title,
				startAt: b.start_at,
				endAt: b.end_at,
				status: b.status,
				metadata: b.metadata ? JSON.parse(b.metadata) : null,
				createdAt: b.created_at,
			})),
		});
	} catch (err) {
		console.error("GET /api/integrations/google-calendar/bookings error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

calendar.post("/api/integrations/google-calendar/book", validateJson(CreateBookingSchema), async (c) => {
	try {
		const body: CreateBookingRequest = c.req.valid("json");

		// D1 に予約レコードを作成
		const booking = await createCalendarBooking(c.env.DB, {
			...body,
			metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
		});

		// Google Calendar にイベントを作成（access_token がある場合のみ、ベストエフォート）
		const conn = await getCalendarConnectionById(c.env.DB, body.connectionId);
		const bookingToken = conn
			? await ensureValidAccessToken(c.env.DB, conn, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET)
			: null;
		if (conn && bookingToken) {
			try {
				const gcal = new GoogleCalendarClient({
					calendarId: conn.calendar_id,
					accessToken: bookingToken,
				});
				const { eventId } = await gcal.createEvent({
					summary: body.title,
					start: body.startAt,
					end: body.endAt,
					description: body.description,
				});
				// event_id を D1 予約レコードに保存
				await updateCalendarBookingEventId(c.env.DB, booking.id, eventId);
				booking.event_id = eventId;
			} catch (err) {
				// Google API 失敗はベストエフォート — D1 予約は維持する
				console.warn("Google Calendar createEvent error (booking still created in D1):", err);
			}
		}

		return c.json(
			{
				success: true,
				data: {
					id: booking.id,
					connectionId: booking.connection_id,
					friendId: booking.friend_id,
					eventId: booking.event_id,
					title: booking.title,
					startAt: booking.start_at,
					endAt: booking.end_at,
					status: booking.status,
					createdAt: booking.created_at,
				},
			},
			201,
		);
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

			// キャンセル時は Google Calendar のイベントも削除する（ベストエフォート）
			if (status === "cancelled") {
				const booking = await getCalendarBookingById(c.env.DB, id);
				if (booking?.event_id && booking.connection_id) {
					const conn = await getCalendarConnectionById(c.env.DB, booking.connection_id);
					const cancelToken = conn
						? await ensureValidAccessToken(c.env.DB, conn, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET)
						: null;
					if (conn && cancelToken) {
						try {
							const gcal = new GoogleCalendarClient({
								calendarId: conn.calendar_id,
								accessToken: cancelToken,
							});
							await gcal.deleteEvent(booking.event_id);
						} catch (err) {
							console.warn("Google Calendar deleteEvent error (status still updated in D1):", err);
						}
					}
				}
			}

			await updateCalendarBookingStatus(c.env.DB, id, status);
			return c.json({ success: true, data: null });
		} catch (err) {
			console.error("PUT /api/integrations/google-calendar/bookings/:id/status error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { calendar };
