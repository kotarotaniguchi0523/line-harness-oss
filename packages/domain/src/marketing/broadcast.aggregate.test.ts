import { describe, expect, it } from "vitest";
import { broadcastId, lineAccountId, tagId } from "../shared/branded.js";
import { ErrorCodes, ErrorMessages } from "../shared/result.js";
import { BroadcastAggregate } from "./broadcast.aggregate.js";

const TEST_BROADCAST = "11111111-1111-1111-1111-111111111111";
const TEST_ACCOUNT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEST_TAG_1 = "22222222-2222-2222-2222-222222222222";

function createBroadcastAggregate() {
	return BroadcastAggregate.create(broadcastId(TEST_BROADCAST), {
		title: "Spring Campaign",
		messageType: "text",
		messageContent: "Hello",
		targetType: "tag",
		targetTagId: tagId(TEST_TAG_1),
		scheduledAt: null,
		lineAccountId: lineAccountId(TEST_ACCOUNT),
	});
}

describe("BroadcastAggregate", () => {
	it("broadcastAggregate_create_statusShouldBeDraft", () => {
		const aggregate = createBroadcastAggregate();

		const status = aggregate.status;

		expect(status).toBe("draft");
	});

	it("broadcastAggregate_schedule_fromDraft_shouldSetScheduled", () => {
		const aggregate = createBroadcastAggregate();

		const result = aggregate.schedule("2026-03-27T10:00:00.000Z");

		expect(result.isOk()).toBe(true);
		expect(aggregate.status).toBe("scheduled");
	});

	it("broadcastAggregate_schedule_fromSent_shouldReturnDomainError", () => {
		const aggregate = BroadcastAggregate.reconstitute(broadcastId(TEST_BROADCAST), {
			title: "Spring Campaign",
			messageType: "text",
			messageContent: "Hello",
			targetType: "all",
			targetTagId: null,
			status: "sent",
			scheduledAt: "2026-03-27T10:00:00.000Z",
			sentAt: "2026-03-27T11:00:00.000Z",
			totalCount: 10,
			successCount: 9,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});

		const result = aggregate.schedule("2026-03-28T10:00:00.000Z");

		expect(result.isErr()).toBe(true);
		const error = result._unsafeUnwrapErr();
		expect(error.code).toBe(ErrorCodes.INVALID_STATE_TRANSITION);
		expect(error.message).toBe(ErrorMessages.CANNOT_SCHEDULE_BROADCAST);
		expect(error.context).toEqual({ currentStatus: "sent" });
		expect(aggregate.status).toBe("sent");
	});

	it("broadcastAggregate_schedule_shouldEmitBroadcastScheduledEvent", () => {
		const aggregate = createBroadcastAggregate();

		aggregate.schedule("2026-03-27T10:00:00.000Z");
		const events = aggregate.pullEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "broadcast_scheduled",
			broadcastId: aggregate.id,
			scheduledAt: "2026-03-27T10:00:00.000Z",
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});
	});

	it("broadcastAggregate_startSending_fromDraft_shouldSetSending", () => {
		const aggregate = createBroadcastAggregate();

		const result = aggregate.startSending();

		expect(result.isOk()).toBe(true);
		expect(aggregate.status).toBe("sending");
	});

	it("broadcastAggregate_startSending_fromScheduled_shouldSetSending", () => {
		const aggregate = createBroadcastAggregate();
		aggregate.schedule("2026-03-27T10:00:00.000Z");
		aggregate.pullEvents();

		const result = aggregate.startSending();

		expect(result.isOk()).toBe(true);
		expect(aggregate.status).toBe("sending");
	});

	it("broadcastAggregate_startSending_fromSent_shouldReturnDomainError", () => {
		const aggregate = BroadcastAggregate.reconstitute(broadcastId(TEST_BROADCAST), {
			title: "Spring Campaign",
			messageType: "text",
			messageContent: "Hello",
			targetType: "all",
			targetTagId: null,
			status: "sent",
			scheduledAt: "2026-03-27T10:00:00.000Z",
			sentAt: "2026-03-27T11:00:00.000Z",
			totalCount: 10,
			successCount: 9,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});

		const result = aggregate.startSending();

		expect(result.isErr()).toBe(true);
		const error = result._unsafeUnwrapErr();
		expect(error.code).toBe(ErrorCodes.INVALID_STATE_TRANSITION);
		expect(error.message).toBe(ErrorMessages.CANNOT_SEND_BROADCAST);
		expect(error.context).toEqual({ currentStatus: "sent" });
		expect(aggregate.status).toBe("sent");
	});

	it("broadcastAggregate_completeSending_shouldSetSentWithCounts", () => {
		const aggregate = createBroadcastAggregate();
		aggregate.startSending();

		aggregate.completeSending(10, 9);

		expect(aggregate.status).toBe("sent");
		expect(aggregate.totalCount).toBe(10);
		expect(aggregate.successCount).toBe(9);
	});

	it("broadcastAggregate_completeSending_shouldEmitBroadcastSentEvent", () => {
		const aggregate = createBroadcastAggregate();
		aggregate.startSending();

		aggregate.completeSending(10, 9);
		const events = aggregate.pullEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "broadcast_sent",
			broadcastId: aggregate.id,
			totalCount: 10,
			lineAccountId: lineAccountId(TEST_ACCOUNT),
		});
	});
});
