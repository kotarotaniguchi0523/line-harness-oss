import { API_DEFAULTS } from "@line-crm/contracts";
import type { Broadcast } from "@line-crm/db";
import {
	createDb,
	DateTime,
	getBroadcastById,
	getBroadcasts,
	getFriendsByTag,
	updateBroadcastStatus,
} from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import { addMessageVariation, calculateStaggerDelay, sleep } from "./stealth.js";

const MULTICAST_BATCH_SIZE = API_DEFAULTS.multicastMaxRecipients;

export async function processBroadcastSend(
	db: D1Database,
	lineClient: LineClient,
	broadcastId: string,
	workerUrl?: string,
): Promise<Broadcast> {
	// Mark as sending
	await updateBroadcastStatus(db, broadcastId, "sending");

	const broadcast = await getBroadcastById(db, broadcastId);
	if (!broadcast) {
		throw new Error(`Broadcast ${broadcastId} not found`);
	}

	// Auto-wrap URLs with tracking links (text with URLs → Flex with button)
	let finalType: string = broadcast.message_type;
	let finalContent = broadcast.message_content;
	if (workerUrl) {
		const { autoTrackContent } = await import("./auto-track.js");
		const tracked = await autoTrackContent(db, broadcast.message_type, broadcast.message_content, workerUrl);
		finalType = tracked.messageType;
		finalContent = tracked.content;
	}
	const message = buildMessage(finalType, finalContent);
	let totalCount = 0;
	let successCount = 0;

	try {
		if (broadcast.target_type === "all") {
			// Use LINE broadcast API (sends to all followers)
			await lineClient.broadcast([message]);
			// We don't have exact count for broadcast API, set as 0 (unknown)
			totalCount = 0;
			successCount = 0;
		} else if (broadcast.target_type === "tag") {
			if (!broadcast.target_tag_id) {
				throw new Error("target_tag_id is required for tag-targeted broadcasts");
			}

			const friends = await getFriendsByTag(db, broadcast.target_tag_id);
			const followingFriends = friends.filter((f) => f.is_following);
			totalCount = followingFriends.length;

			// Send in batches with stealth delays to mimic human patterns
			const _now = DateTime.now().toISO();
			const drizzle = createDb(db);
			const totalBatches = Math.ceil(followingFriends.length / MULTICAST_BATCH_SIZE);
			for (let i = 0; i < followingFriends.length; i += MULTICAST_BATCH_SIZE) {
				const batchIndex = Math.floor(i / MULTICAST_BATCH_SIZE);
				const batch = followingFriends.slice(i, i + MULTICAST_BATCH_SIZE);
				const lineUserIds = batch.map((f) => f.line_user_id);

				// Stealth: add staggered delay between batches
				if (batchIndex > 0) {
					const delay = calculateStaggerDelay(followingFriends.length, batchIndex);
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

					// Log successfully sent messages in a single batch INSERT
					await drizzle.insert(messagesLog).values(
						batch.map((friend) => ({
							id: crypto.randomUUID(),
							friendId: friend.id,
							direction: "outgoing" as const,
							messageType: broadcast.message_type,
							content: broadcast.message_content,
							broadcastId,
							scenarioStepId: null,
						})),
					);
				} catch (err) {
					console.error(`Multicast batch ${i / MULTICAST_BATCH_SIZE} failed:`, err);
					// Continue with next batch; failed batch is not logged
				}
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

export async function processScheduledBroadcasts(
	db: D1Database,
	lineClient: LineClient,
	workerUrl?: string,
): Promise<void> {
	const _now = DateTime.now().toISO();
	const allBroadcasts = await getBroadcasts(db);

	const nowMs = Date.now();
	const scheduled = allBroadcasts.filter(
		(b) => b.status === "scheduled" && b.scheduled_at !== null && new Date(b.scheduled_at).getTime() <= nowMs,
	);

	for (const broadcast of scheduled) {
		try {
			await processBroadcastSend(db, lineClient, broadcast.id, workerUrl);
		} catch (err) {
			console.error(`Failed to send scheduled broadcast ${broadcast.id}:`, err);
			// Continue with next broadcast
		}
	}
}
