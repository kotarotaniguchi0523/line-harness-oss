import { API_DEFAULTS } from "@line-crm/contracts";
import type { Broadcast } from "@line-crm/db";
import { createDb, DateTime, getBroadcastById, updateBroadcastStatus } from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import type { SegmentCondition } from "./segment-query.js";
import { buildSegmentQuery } from "./segment-query.js";
import { addMessageVariation, calculateStaggerDelay, sleep } from "./stealth.js";

const MULTICAST_BATCH_SIZE = API_DEFAULTS.multicastMaxRecipients;

interface FriendRow {
	id: string;
	line_user_id: string;
}

export async function processSegmentSend(
	db: D1Database,
	lineClient: LineClient,
	broadcastId: string,
	condition: SegmentCondition,
): Promise<Broadcast> {
	// Mark as sending
	await updateBroadcastStatus(db, broadcastId, "sending");

	const broadcast = await getBroadcastById(db, broadcastId);
	if (!broadcast) {
		throw new Error(`Broadcast ${broadcastId} not found`);
	}

	const message = buildMessage(broadcast.message_type, broadcast.message_content);

	let totalCount = 0;
	let successCount = 0;

	try {
		// Build and execute segment query to get matching friends
		const { sql, bindings } = buildSegmentQuery(condition);
		const queryResult = await db
			.prepare(sql)
			.bind(...bindings)
			.all<FriendRow>();

		const friends = queryResult.results ?? [];
		totalCount = friends.length;

		const _now = DateTime.now().toISO();
		const totalBatches = Math.ceil(friends.length / MULTICAST_BATCH_SIZE);

		for (let i = 0; i < friends.length; i += MULTICAST_BATCH_SIZE) {
			const batchIndex = Math.floor(i / MULTICAST_BATCH_SIZE);
			const batch = friends.slice(i, i + MULTICAST_BATCH_SIZE);
			const lineUserIds = batch.map((f) => f.line_user_id);

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

				// Log successfully sent messages
				const drizzle = createDb(db);
				for (const friend of batch) {
					await drizzle.insert(messagesLog).values({
						id: crypto.randomUUID(),
						friendId: friend.id,
						direction: "outgoing",
						messageType: broadcast.message_type,
						content: broadcast.message_content,
						broadcastId,
						scenarioStepId: null,
					});
				}
			} catch (err) {
				console.error(`Segment multicast batch ${batchIndex} failed:`, err);
				// Continue with next batch; failed batch is not logged
			}
		}

		await updateBroadcastStatus(db, broadcastId, "sent", { totalCount, successCount });
	} catch (err) {
		// On failure, reset to draft so it can be retried
		await updateBroadcastStatus(db, broadcastId, "draft");
		throw err;
	}

	const result = await getBroadcastById(db, broadcastId);
	if (!result) throw new Error(`Broadcast ${broadcastId} not found after send`);
	return result;
}
