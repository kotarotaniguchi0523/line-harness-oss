// =============================================================================
// Broadcast Aggregate Root
//
// Props are split into Config (性質/不変) and MutableState (状態/変化).
// The aggregate holds both via BroadcastProps = BroadcastConfig & BroadcastMutableState.
// =============================================================================

import { AggregateRoot } from "../shared/aggregate.js";
import type { BroadcastId, LineAccountId, TagId } from "../shared/branded.js";
import type { BroadcastScheduled, BroadcastSent } from "../shared/domain-event.js";
import type { Result } from "../shared/result.js";
import { type DomainError, domainError, ErrorCodes, ErrorMessages, err, ok } from "../shared/result.js";

// =============================================================================
// Config (性質 -- 作成時に決定、以後不変)
// =============================================================================

export type BroadcastTargetType = "all" | "tag";

interface BroadcastConfig {
	readonly title: string;
	readonly messageType: string;
	readonly messageContent: string;
	readonly targetType: BroadcastTargetType;
	readonly targetTagId: TagId | null;
	readonly lineAccountId: LineAccountId | null;
}

// =============================================================================
// Mutable State (状態 -- 時間とともに変化する)
// =============================================================================

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent";

interface BroadcastMutableState {
	status: BroadcastStatus;
	scheduledAt: string | null;
	sentAt: string | null;
	totalCount: number;
	successCount: number;
}

// =============================================================================
// Aggregate Props (Config + MutableState の合成)
// =============================================================================

export interface BroadcastProps extends BroadcastConfig, BroadcastMutableState {}

// =============================================================================
// Aggregate Root
// =============================================================================

export class BroadcastAggregate extends AggregateRoot<BroadcastId> {
	private constructor(
		id: BroadcastId,
		private props: BroadcastProps,
	) {
		super(id);
	}

	// ---------------------------------------------------------------------------
	// Factory
	// ---------------------------------------------------------------------------

	static create(
		id: BroadcastId,
		config: Omit<BroadcastProps, "status" | "sentAt" | "totalCount" | "successCount">,
	): BroadcastAggregate {
		return new BroadcastAggregate(id, {
			...config,
			status: "draft",
			sentAt: null,
			totalCount: 0,
			successCount: 0,
		});
	}

	static reconstitute(id: BroadcastId, props: BroadcastProps): BroadcastAggregate {
		return new BroadcastAggregate(id, props);
	}

	// ---------------------------------------------------------------------------
	// Queries -- 性質を返す (Config getters)
	// ---------------------------------------------------------------------------

	get title(): string {
		return this.props.title;
	}
	get messageType(): string {
		return this.props.messageType;
	}
	get messageContent(): string {
		return this.props.messageContent;
	}
	get targetType(): BroadcastTargetType {
		return this.props.targetType;
	}
	get targetTagId(): TagId | null {
		return this.props.targetTagId;
	}
	get lineAccountId(): LineAccountId | null {
		return this.props.lineAccountId;
	}

	// ---------------------------------------------------------------------------
	// Queries -- 状態を返す (State getters)
	// ---------------------------------------------------------------------------

	get status(): BroadcastStatus {
		return this.props.status;
	}
	get scheduledAt(): string | null {
		return this.props.scheduledAt;
	}
	get sentAt(): string | null {
		return this.props.sentAt;
	}
	get totalCount(): number {
		return this.props.totalCount;
	}
	get successCount(): number {
		return this.props.successCount;
	}

	// ---------------------------------------------------------------------------
	// Commands -- 状態を変更する (State mutations)
	// ---------------------------------------------------------------------------

	schedule(at: string): Result<void, DomainError> {
		if (this.props.status !== "draft") {
			return err(
				domainError(ErrorCodes.INVALID_STATE_TRANSITION, ErrorMessages.CANNOT_SCHEDULE_BROADCAST, {
					currentStatus: this.props.status,
				}),
			);
		}
		this.props.status = "scheduled";
		this.props.scheduledAt = at;
		this.addEvent({
			type: "broadcast_scheduled",
			broadcastId: this.id,
			scheduledAt: at,
			lineAccountId: this.props.lineAccountId,
			occurredAt: new Date().toISOString(),
		} satisfies BroadcastScheduled);
		return ok(undefined);
	}

	startSending(): Result<void, DomainError> {
		if (this.props.status !== "draft" && this.props.status !== "scheduled") {
			return err(
				domainError(ErrorCodes.INVALID_STATE_TRANSITION, ErrorMessages.CANNOT_SEND_BROADCAST, {
					currentStatus: this.props.status,
				}),
			);
		}
		this.props.status = "sending";
		return ok(undefined);
	}

	completeSending(totalCount: number, successCount: number): void {
		this.props.status = "sent";
		this.props.sentAt = new Date().toISOString();
		this.props.totalCount = totalCount;
		this.props.successCount = successCount;
		this.addEvent({
			type: "broadcast_sent",
			broadcastId: this.id,
			totalCount,
			lineAccountId: this.props.lineAccountId,
			occurredAt: new Date().toISOString(),
		} satisfies BroadcastSent);
	}
}
