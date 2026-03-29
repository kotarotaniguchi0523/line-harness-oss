import { z } from "zod";
import { AdConversionLogStatus, CalendarAuthType, CalendarBookingStatus } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

// =============================================================================
// Webhook
// =============================================================================
export const IncomingWebhookSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	sourceType: z.string().default("custom"),
	secret: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type IncomingWebhook = z.infer<typeof IncomingWebhookSchema>;

export const OutgoingWebhookSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	url: z.string().url(),
	eventTypes: z.array(z.string()),
	secret: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type OutgoingWebhook = z.infer<typeof OutgoingWebhookSchema>;

// =============================================================================
// Google Calendar
// =============================================================================
export const GoogleCalendarConnectionSchema = z.object({
	id: UuidSchema,
	calendarId: z.string().min(1),
	authType: CalendarAuthType,
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type GoogleCalendarConnection = z.infer<typeof GoogleCalendarConnectionSchema>;

export const CalendarBookingSchema = z.object({
	id: UuidSchema,
	connectionId: UuidSchema,
	friendId: UuidSchema.nullable(),
	eventId: z.string().nullable(),
	title: z.string().min(1),
	startAt: IsoDateSchema,
	endAt: IsoDateSchema,
	status: CalendarBookingStatus,
	metadata: z.string().nullable(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type CalendarBooking = z.infer<typeof CalendarBookingSchema>;

// =============================================================================
// Stripe
// =============================================================================
export const StripeEventSchema = z.object({
	id: UuidSchema,
	stripeEventId: z.string().min(1),
	eventType: z.string().min(1),
	friendId: UuidSchema.nullable(),
	amount: z.number().nullable(),
	currency: z.string().nullable(),
	metadata: z.string().nullable(),
	processedAt: IsoDateSchema,
});
export type StripeEvent = z.infer<typeof StripeEventSchema>;

// =============================================================================
// Conversion
// =============================================================================
export const ConversionPointSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	eventType: z.string().min(1),
	value: z.number().nullable(),
	createdAt: IsoDateSchema,
});
export type ConversionPoint = z.infer<typeof ConversionPointSchema>;

export const ConversionEventSchema = z.object({
	id: UuidSchema,
	conversionPointId: UuidSchema,
	friendId: UuidSchema,
	userId: UuidSchema.nullable(),
	affiliateCode: z.string().nullable(),
	metadata: z.string().nullable(),
	createdAt: IsoDateSchema,
});
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;

// =============================================================================
// Affiliate
// =============================================================================
export const AffiliateSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	code: z.string().min(1),
	commissionRate: z.number().min(0).max(100),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
});
export type Affiliate = z.infer<typeof AffiliateSchema>;

export const AffiliateClickSchema = z.object({
	id: UuidSchema,
	affiliateId: UuidSchema,
	url: z.string().nullable(),
	ipAddress: z.string().nullable(),
	createdAt: IsoDateSchema,
});
export type AffiliateClick = z.infer<typeof AffiliateClickSchema>;

// =============================================================================
// Ad Platform
// =============================================================================
export const AdPlatformSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	displayName: z.string().nullable(),
	config: z.record(z.unknown()),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type AdPlatform = z.infer<typeof AdPlatformSchema>;

export const AdConversionLogSchema = z.object({
	id: UuidSchema,
	adPlatformId: UuidSchema,
	friendId: UuidSchema,
	conversionPointId: UuidSchema.nullable(),
	eventName: z.string().min(1),
	clickId: z.string().nullable(),
	clickIdType: z.string().nullable(),
	status: AdConversionLogStatus,
	requestBody: z.string().nullable(),
	responseBody: z.string().nullable(),
	errorMessage: z.string().nullable(),
	createdAt: IsoDateSchema,
});
export type AdConversionLog = z.infer<typeof AdConversionLogSchema>;
