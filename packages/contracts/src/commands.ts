// =============================================================================
// CQRS Command & Query Types
//
// Preparation layer for Command/Query Responsibility Segregation.
// Commands represent write intents; Queries represent read intents.
// All fields are readonly to enforce immutability at the type level.
// =============================================================================

import type { CalendarBookingStatus, ChatStatus, ScenarioTriggerType } from "./enums.js";

// =============================================================================
// Commands (write operations)
// =============================================================================

/** Assign a tag to a friend */
export interface AssignTagCommand {
	readonly friendId: string;
	readonly tagId: string;
	readonly staffId: string;
}

/** Remove a tag from a friend */
export interface RemoveTagCommand {
	readonly friendId: string;
	readonly tagId: string;
	readonly staffId: string;
}

/** Create a new scenario with steps */
export interface CreateScenarioCommand {
	readonly name: string;
	readonly description?: string;
	readonly triggerType: ScenarioTriggerType;
	readonly triggerTagId?: string;
	readonly lineAccountId?: string;
	readonly staffId: string;
}

/** Add a step to an existing scenario */
export interface AddScenarioStepCommand {
	readonly scenarioId: string;
	readonly stepOrder: number;
	readonly delayMinutes: number;
	readonly messageType: string;
	readonly messageContent: string;
	readonly staffId: string;
}

/** Remove a step from a scenario */
export interface RemoveScenarioStepCommand {
	readonly stepId: string;
	readonly staffId: string;
}

/** Toggle scenario active/inactive */
export interface ToggleScenarioCommand {
	readonly scenarioId: string;
	readonly isActive: boolean;
	readonly staffId: string;
}

/** Delete a scenario (soft delete) */
export interface DeleteScenarioCommand {
	readonly scenarioId: string;
	readonly staffId: string;
}

/** Send a chat message from an operator */
export interface SendChatMessageCommand {
	readonly chatId: string;
	readonly messageType: string;
	readonly content: string;
	readonly operatorId?: string;
}

/** Create a new chat session */
export interface CreateChatCommand {
	readonly friendId: string;
	readonly operatorId?: string;
	readonly lineAccountId?: string;
}

/** Update chat assignment or status */
export interface UpdateChatCommand {
	readonly chatId: string;
	readonly operatorId?: string | null;
	readonly status?: ChatStatus;
	readonly notes?: string;
}

/** Create a new operator */
export interface CreateOperatorCommand {
	readonly name: string;
	readonly email: string;
	readonly role?: string;
}

/** Connect a Google Calendar integration */
export interface ConnectCalendarCommand {
	readonly calendarId: string;
	readonly authType: string;
	readonly accessToken?: string;
	readonly refreshToken?: string;
	readonly apiKey?: string;
	readonly staffId: string;
}

/** Book a calendar slot */
export interface CreateBookingCommand {
	readonly connectionId: string;
	readonly friendId?: string;
	readonly title: string;
	readonly startAt: string;
	readonly endAt: string;
	readonly description?: string;
	readonly metadata?: Record<string, unknown>;
}

/** Update booking status (confirm, cancel, complete) */
export interface UpdateBookingStatusCommand {
	readonly bookingId: string;
	readonly status: CalendarBookingStatus;
}

/** Create a tracked link */
export interface CreateTrackedLinkCommand {
	readonly name: string;
	readonly originalUrl: string;
	readonly tagId?: string | null;
	readonly scenarioId?: string | null;
}

/** Submit a form response */
export interface SubmitFormCommand {
	readonly formId: string;
	readonly lineUserId?: string;
	readonly friendId?: string;
	readonly data: Record<string, unknown>;
}

// =============================================================================
// Queries (read operations)
// =============================================================================

/** List friends with optional filtering and pagination */
export interface ListFriendsQuery {
	readonly page: number;
	readonly limit: number;
	readonly tagId?: string;
	readonly lineAccountId?: string;
	readonly search?: string;
}

/** Get a single friend by ID */
export interface GetFriendQuery {
	readonly friendId: string;
}

/** Count friends, optionally scoped to a LINE account */
export interface CountFriendsQuery {
	readonly lineAccountId?: string;
}

/** List scenarios, optionally scoped to a LINE account */
export interface ListScenariosQuery {
	readonly lineAccountId?: string;
}

/** Get a single scenario by ID */
export interface GetScenarioQuery {
	readonly scenarioId: string;
}

/** List chats with optional filters */
export interface ListChatsQuery {
	readonly status?: string;
	readonly operatorId?: string;
	readonly lineAccountId?: string;
}

/** Get calendar slots for a specific date */
export interface GetCalendarSlotsQuery {
	readonly connectionId: string;
	readonly date: string;
	readonly slotMinutes: number;
	readonly startHour: number;
	readonly endHour: number;
}

/** List calendar bookings with optional filters */
export interface ListCalendarBookingsQuery {
	readonly connectionId?: string;
	readonly friendId?: string;
}

/** List tracked links */
export interface ListTrackedLinksQuery {
	readonly page?: number;
	readonly limit?: number;
}

/** Get tracked link details with click history */
export interface GetTrackedLinkQuery {
	readonly linkId: string;
}
