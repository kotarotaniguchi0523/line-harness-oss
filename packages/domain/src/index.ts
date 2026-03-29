// Shared

export type { FriendProps } from "./crm/friend.aggregate.js";
// CRM
export { FriendAggregate } from "./crm/friend.aggregate.js";
export type { BroadcastProps, BroadcastStatus, BroadcastTargetType } from "./marketing/broadcast.aggregate.js";
// Marketing
export { BroadcastAggregate } from "./marketing/broadcast.aggregate.js";
export type { ScenarioProps, ScenarioStepProps, ScenarioTriggerType } from "./marketing/scenario.aggregate.js";
export { ScenarioAggregate } from "./marketing/scenario.aggregate.js";
export { AggregateRoot } from "./shared/aggregate.js";
export * from "./shared/branded.js";
export * from "./shared/domain-event.js";
export * from "./shared/result.js";
