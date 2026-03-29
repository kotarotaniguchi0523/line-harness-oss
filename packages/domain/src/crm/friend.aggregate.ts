// =============================================================================
// Friend Aggregate Root
//
// Props are split into Identity (性質/不変) and MutableState (状態/変化).
// The aggregate holds both via FriendProps = FriendIdentity & FriendMutableState.
// =============================================================================

import { AggregateRoot } from "../shared/aggregate.js";
import type { FriendId, LineAccountId, LineUserId, TagId } from "../shared/branded.js";
import type { FriendAdded, FriendUnfollowed, TagAssigned, TagRemoved } from "../shared/domain-event.js";
import type { Result } from "../shared/result.js";
import { type DomainError, domainError, ErrorCodes, ErrorMessages, err, ok } from "../shared/result.js";

// =============================================================================
// Identity (性質 -- 作成時に決定、以後不変)
// =============================================================================

interface FriendIdentity {
	readonly lineUserId: LineUserId;
	readonly lineAccountId: LineAccountId | null;
	readonly tagIds: ReadonlySet<TagId>;
}

// =============================================================================
// Mutable State (状態 -- 時間とともに変化する)
// =============================================================================

interface FriendMutableState {
	displayName: string | null;
	pictureUrl: string | null;
	statusMessage: string | null;
	isFollowing: boolean;
	score: number;
	metadata: Record<string, unknown> | null;
}

// =============================================================================
// Aggregate Props (Identity + MutableState の合成)
// =============================================================================

export interface FriendProps extends FriendIdentity, FriendMutableState {}

// =============================================================================
// Aggregate Root
// =============================================================================

export class FriendAggregate extends AggregateRoot<FriendId> {
	private constructor(
		id: FriendId,
		private props: FriendProps,
	) {
		super(id);
	}

	// ---------------------------------------------------------------------------
	// Factory
	// ---------------------------------------------------------------------------

	static create(
		id: FriendId,
		lineUserId: LineUserId,
		displayName: string | null,
		lineAccountId: LineAccountId | null,
	): FriendAggregate {
		const friend = new FriendAggregate(id, {
			// Identity (性質)
			lineUserId,
			lineAccountId,
			tagIds: new Set(),
			// MutableState (状態 -- 初期値)
			displayName,
			pictureUrl: null,
			statusMessage: null,
			isFollowing: true,
			score: 0,
			metadata: null,
		});
		friend.addEvent({
			type: "friend_added",
			friendId: id,
			displayName,
			lineAccountId,
			occurredAt: new Date().toISOString(),
		} satisfies FriendAdded);
		return friend;
	}

	static reconstitute(id: FriendId, props: FriendProps): FriendAggregate {
		return new FriendAggregate(id, props);
	}

	// ---------------------------------------------------------------------------
	// Queries -- 性質を返す (Identity getters)
	// ---------------------------------------------------------------------------

	get lineUserId(): LineUserId {
		return this.props.lineUserId;
	}
	get lineAccountId(): LineAccountId | null {
		return this.props.lineAccountId;
	}
	get tagIds(): ReadonlySet<TagId> {
		return this.props.tagIds;
	}

	// ---------------------------------------------------------------------------
	// Queries -- 状態を返す (State getters)
	// ---------------------------------------------------------------------------

	get displayName(): string | null {
		return this.props.displayName;
	}
	get isFollowing(): boolean {
		return this.props.isFollowing;
	}
	get score(): number {
		return this.props.score;
	}
	get metadata(): Record<string, unknown> | null {
		return this.props.metadata;
	}

	// ---------------------------------------------------------------------------
	// Commands -- 状態を変更する (State mutations)
	// ---------------------------------------------------------------------------

	unfollow(): void {
		this.props.isFollowing = false;
		this.addEvent({
			type: "friend_unfollowed",
			friendId: this.id,
			lineAccountId: this.props.lineAccountId,
			occurredAt: new Date().toISOString(),
		} satisfies FriendUnfollowed);
	}

	refollow(displayName: string | null, pictureUrl: string | null): void {
		this.props.isFollowing = true;
		this.props.displayName = displayName;
		this.props.pictureUrl = pictureUrl;
	}

	assignTag(tagId: TagId): Result<void, DomainError> {
		if (this.props.tagIds.has(tagId)) {
			return ok(undefined); // idempotent
		}
		(this.props.tagIds as Set<TagId>).add(tagId);
		this.addEvent({
			type: "tag_assigned",
			friendId: this.id,
			tagId,
			lineAccountId: this.props.lineAccountId,
			occurredAt: new Date().toISOString(),
		} satisfies TagAssigned);
		return ok(undefined);
	}

	removeTag(tagId: TagId): Result<void, DomainError> {
		if (!this.props.tagIds.has(tagId)) {
			return err(domainError(ErrorCodes.NOT_ASSIGNED, ErrorMessages.TAG_NOT_ASSIGNED, { tagId }));
		}
		(this.props.tagIds as Set<TagId>).delete(tagId);
		this.addEvent({
			type: "tag_removed",
			friendId: this.id,
			tagId,
			lineAccountId: this.props.lineAccountId,
			occurredAt: new Date().toISOString(),
		} satisfies TagRemoved);
		return ok(undefined);
	}

	addScore(delta: number): void {
		this.props.score += delta;
	}

	updateProfile(displayName: string | null, pictureUrl: string | null, statusMessage: string | null): void {
		this.props.displayName = displayName;
		this.props.pictureUrl = pictureUrl;
		this.props.statusMessage = statusMessage;
	}

	setMetadata(key: string, value: unknown): void {
		if (!this.props.metadata) this.props.metadata = {};
		this.props.metadata[key] = value;
	}
}
