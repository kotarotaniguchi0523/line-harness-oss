import { z } from "zod";
import { CalendarAuthType, CalendarBookingStatus } from "../enums.js";

// =============================================================================
// Calendar Connection — Request Schemas
// =============================================================================

/**
 * Schema for connecting a new Google Calendar integration.
 * Used by POST /api/integrations/google-calendar/connect
 */
export const ConnectCalendarSchema = z.object({
	calendarId: z.string().min(1),
	authType: CalendarAuthType,
	accessToken: z.string().optional(),
	refreshToken: z.string().optional(),
	apiKey: z.string().optional(),
});
export type ConnectCalendarRequest = z.infer<typeof ConnectCalendarSchema>;

/**
 * Schema for creating a new calendar booking.
 * Used by POST /api/integrations/google-calendar/book
 */
export const CreateBookingSchema = z.object({
	connectionId: z.string().uuid(),
	friendId: z.string().uuid().optional(),
	title: z.string().min(1),
	startAt: z.string().min(1),
	endAt: z.string().min(1),
	description: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
});
export type CreateBookingRequest = z.infer<typeof CreateBookingSchema>;

/**
 * Schema for updating a booking's status.
 * Used by PUT /api/integrations/google-calendar/bookings/:id/status
 */
export const UpdateBookingStatusSchema = z.object({
	status: CalendarBookingStatus,
});
export type UpdateBookingStatusRequest = z.infer<typeof UpdateBookingStatusSchema>;

/**
 * Schema for querying available calendar slots.
 * Used by GET /api/integrations/google-calendar/slots (query params)
 */
export const CalendarSlotsQuerySchema = z.object({
	connectionId: z.string().min(1),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	slotMinutes: z.coerce.number().int().positive().default(60),
	startHour: z.coerce.number().int().min(0).max(23).default(9),
	endHour: z.coerce.number().int().min(1).max(24).default(18),
});
export type CalendarSlotsQuery = z.infer<typeof CalendarSlotsQuerySchema>;

/**
 * Schema for querying calendar bookings list.
 * Used by GET /api/integrations/google-calendar/bookings (query params)
 */
export const CalendarBookingsQuerySchema = z.object({
	connectionId: z.string().uuid().optional(),
	friendId: z.string().uuid().optional(),
});
export type CalendarBookingsQuery = z.infer<typeof CalendarBookingsQuerySchema>;
