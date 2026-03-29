// =============================================================================
// Base Aggregate Root - collects domain events
// =============================================================================

import type { DomainEvent } from "./domain-event.js";

export abstract class AggregateRoot<TId extends string> {
	private _domainEvents: DomainEvent[] = [];

	constructor(public readonly id: TId) {}

	protected addEvent(event: DomainEvent): void {
		this._domainEvents.push(event);
	}

	pullEvents(): DomainEvent[] {
		const events = [...this._domainEvents];
		this._domainEvents = [];
		return events;
	}

	get pendingEvents(): readonly DomainEvent[] {
		return this._domainEvents;
	}
}
