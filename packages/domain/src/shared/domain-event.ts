// =============================================================================
// Domain Event definitions
// =============================================================================

import type { AutomationId, BroadcastId, FriendId, LineAccountId, ScenarioId, TagId } from "./branded.js";

export type DomainEvent =
	| FriendAdded
	| FriendUnfollowed
	| TagAssigned
	| TagRemoved
	| ScenarioEnrolled
	| ScenarioCompleted
	| BroadcastSent
	| BroadcastScheduled
	| MessageReceived
	| ConversionFired
	| ScoreThresholdReached
	| AutomationTriggered
	| CalendarBooked;

interface BaseEvent {
	readonly occurredAt: string;
	readonly lineAccountId: LineAccountId | null;
}

export interface FriendAdded extends BaseEvent {
	readonly type: "friend_added";
	readonly friendId: FriendId;
	readonly displayName: string | null;
}

export interface FriendUnfollowed extends BaseEvent {
	readonly type: "friend_unfollowed";
	readonly friendId: FriendId;
}

export interface TagAssigned extends BaseEvent {
	readonly type: "tag_assigned";
	readonly friendId: FriendId;
	readonly tagId: TagId;
}

export interface TagRemoved extends BaseEvent {
	readonly type: "tag_removed";
	readonly friendId: FriendId;
	readonly tagId: TagId;
}

export interface ScenarioEnrolled extends BaseEvent {
	readonly type: "scenario_enrolled";
	readonly friendId: FriendId;
	readonly scenarioId: ScenarioId;
}

export interface ScenarioCompleted extends BaseEvent {
	readonly type: "scenario_completed";
	readonly friendId: FriendId;
	readonly scenarioId: ScenarioId;
}

export interface BroadcastSent extends BaseEvent {
	readonly type: "broadcast_sent";
	readonly broadcastId: BroadcastId;
	readonly totalCount: number;
}

export interface BroadcastScheduled extends BaseEvent {
	readonly type: "broadcast_scheduled";
	readonly broadcastId: BroadcastId;
	readonly scheduledAt: string;
}

export interface MessageReceived extends BaseEvent {
	readonly type: "message_received";
	readonly friendId: FriendId;
	readonly messageText: string;
}

export interface ConversionFired extends BaseEvent {
	readonly type: "conversion_fired";
	readonly friendId: FriendId;
	readonly eventName: string;
	readonly eventValue: number | null;
}

export interface ScoreThresholdReached extends BaseEvent {
	readonly type: "score_threshold_reached";
	readonly friendId: FriendId;
	readonly currentScore: number;
	readonly threshold: number;
}

export interface AutomationTriggered extends BaseEvent {
	readonly type: "automation_triggered";
	readonly automationId: AutomationId;
	readonly friendId: FriendId;
}

export interface CalendarBooked extends BaseEvent {
	readonly type: "calendar_booked";
	readonly friendId: FriendId;
	readonly bookingTitle: string;
}
