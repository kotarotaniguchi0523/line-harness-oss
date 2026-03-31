import { API_DEFAULTS } from "@line-crm/contracts";
import { createBroadcastRepository, createDb, DateTime } from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import type { BroadcastId } from "@line-crm/domain";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import type { SegmentCondition } from "./segment-query.js";
import { executeSegmentQuery } from "./segment-query.js";
import { addMessageVariation, calculateStaggerDelay, sleep } from "./stealth.js";

const MULTICAST_BATCH_SIZE = API_DEFAULTS.multicastMaxRecipients;

export async function processSegmentSend(
	db: D1Database,
	lineClient: LineClient,
	broadcastId: string,
	condition: SegmentCondition,
): Promise<NonNullable<Awaited<ReturnType<ReturnType<typeof createBroadcastRepository>["findById"]>>>> {
	const drizzle = createDb(db);
	const broadcastRepo = createBroadcastRepository(drizzle);

	// Mark as sending
	await broadcastRepo.updateStatus(broadcastId as BroadcastId, "sending");

	const broadcast = await broadcastRepo.findById(broadcastId as BroadcastId);
	if (!broadcast) {
		throw new Error(`Broadcast ${broadcastId} not found`);
	}

	const message = buildMessage(broadcast.messageType, broadcast.messageContent);

	let totalCount = 0;
	let successCount = 0;

	try {
		const friends = await executeSegmentQuery(drizzle, condition);
		totalCount = friends.length;

		const _now = DateTime.now().toISO();
		const totalBatches = Math.ceil(friends.length / MULTICAST_BATCH_SIZE);

		for (let i = 0; i < friends.length; i += MULTICAST_BATCH_SIZE) {
			const batchIndex = Math.floor(i / MULTICAST_BATCH_SIZE);
			const batch = friends.slice(i, i + MULTICAST_BATCH_SIZE);
			const lineUserIds = batch.map((f) => f.lineUserId);

			// Stealth: stagger delays between batches
			if (batchIndex > 0) {
				const delay = calculateStaggerDelay(friends.length, batchIndex);
				await sleep(delay);
			}

			// Stealth: add slight variation to text messages
			let batchMessage = message;
			if (message.type === "text" && totalBatches > 1) {
				batchMessage = { ...message, text: addMessageVariation(message.text, batchIndex) };
			}

			try {
				await lineClient.multicast(lineUserIds, [batchMessage]);
				successCount += batch.length;

				// Log successfully sent messages (batch insert)
				await drizzle.insert(messagesLog).values(
					batch.map((friend) => ({
						id: crypto.randomUUID(),
						friendId: friend.id,
						direction: "outgoing",
						messageType: broadcast.messageType,
						content: broadcast.messageContent,
						broadcastId,
						scenarioStepId: null,
					})),
				);
			} catch (err) {
				console.error(`Segment multicast batch ${batchIndex} failed:`, err);
				// Continue with next batch; failed batch is not logged
			}
		}

		await broadcastRepo.updateStatus(broadcastId as BroadcastId, "sent", { totalCount, successCount });
	} catch (err) {
		// On failure, reset to draft so it can be retried
		await broadcastRepo.updateStatus(broadcastId as BroadcastId, "draft");
		throw err;
	}

	const result = await broadcastRepo.findById(broadcastId as BroadcastId);
	if (!result) throw new Error(`Broadcast ${broadcastId} not found after send`);
	return result;
}
