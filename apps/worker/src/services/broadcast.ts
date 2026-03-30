import { API_DEFAULTS } from "@line-crm/contracts";
import { createBroadcastRepository, createDb, createTagRepository, DateTime } from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import type { BroadcastId, TagId } from "@line-crm/domain";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import { addMessageVariation, calculateStaggerDelay, sleep } from "./stealth.js";

const MULTICAST_BATCH_SIZE = API_DEFAULTS.multicastMaxRecipients;

export async function processBroadcastSend(
	db: D1Database,
	lineClient: LineClient,
	broadcastId: string,
	workerUrl?: string,
) {
	const drizzle = createDb(db);
	const broadcastRepo = createBroadcastRepository(drizzle);
	const tagRepo = createTagRepository(drizzle);

	// Mark as sending
	await broadcastRepo.updateStatus(broadcastId as BroadcastId, "sending");

	const broadcast = await broadcastRepo.findById(broadcastId as BroadcastId);
	if (!broadcast) {
		throw new Error(`Broadcast ${broadcastId} not found`);
	}

	// Auto-wrap URLs with tracking links (text with URLs → Flex with button)
	let finalType: string = broadcast.messageType;
	let finalContent = broadcast.messageContent;
	if (workerUrl) {
		const { autoTrackContent } = await import("./auto-track.js");
		const tracked = await autoTrackContent(db, broadcast.messageType, broadcast.messageContent, workerUrl);
		finalType = tracked.messageType;
		finalContent = tracked.content;
	}
	const message = buildMessage(finalType, finalContent);
	let totalCount = 0;
	let successCount = 0;

	try {
		if (broadcast.targetType === "all") {
			// Use LINE broadcast API (sends to all followers)
			await lineClient.broadcast([message]);
			// We don't have exact count for broadcast API, set as 0 (unknown)
			totalCount = 0;
			successCount = 0;
		} else if (broadcast.targetType === "tag") {
			if (!broadcast.targetTagId) {
				throw new Error("target_tag_id is required for tag-targeted broadcasts");
			}

			const tagFriends = await tagRepo.getFriendsByTag(broadcast.targetTagId as TagId);
			const followingFriends = tagFriends.filter(
				(f) =>
					(f as unknown as Record<string, unknown>).isFollowing ??
					(f as unknown as Record<string, unknown>).is_following,
			);
			totalCount = followingFriends.length;

			// Send in batches with stealth delays to mimic human patterns
			const _now = DateTime.now().toISO();
			const drizzle = createDb(db);
			const totalBatches = Math.ceil(followingFriends.length / MULTICAST_BATCH_SIZE);
			for (let i = 0; i < followingFriends.length; i += MULTICAST_BATCH_SIZE) {
				const batchIndex = Math.floor(i / MULTICAST_BATCH_SIZE);
				const batch = followingFriends.slice(i, i + MULTICAST_BATCH_SIZE);
				const lineUserIds = batch.map(
					(f) =>
						((f as unknown as Record<string, unknown>).lineUserId as string) ??
						((f as unknown as Record<string, unknown>).line_user_id as string),
				);

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
							messageType: broadcast.messageType,
							content: broadcast.messageContent,
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

export async function processScheduledBroadcasts(
	db: D1Database,
	lineClient: LineClient,
	workerUrl?: string,
): Promise<void> {
	const drizzle = createDb(db);
	const broadcastRepo = createBroadcastRepository(drizzle);
	const _now = DateTime.now().toISO();
	const allBroadcasts = await broadcastRepo.list();

	const nowMs = Date.now();
	const scheduled = allBroadcasts.filter(
		(b) => b.status === "scheduled" && b.scheduledAt !== null && new Date(b.scheduledAt).getTime() <= nowMs,
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
