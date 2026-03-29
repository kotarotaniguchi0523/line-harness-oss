import {
	createAutoReplyRepository,
	createChatRepository,
	createFriendRepository,
	createGroupChatRepository,
	createScenarioRepository,
	type Database,
	DateTime,
} from "@line-crm/db";
import { chats, friendScenarios, friends, lineAccounts } from "@line-crm/db/schema";
import type { FriendId, LineAccountId, LineUserId, ScenarioId } from "@line-crm/domain";
import type {
	FollowEvent,
	GroupSource,
	JoinEvent,
	LeaveEvent,
	MessageEvent,
	RoomSource,
	TextEventMessage,
	WebhookEvent,
	WebhookRequestBody,
} from "@line-crm/line-sdk";
import { LineClient, verifySignature } from "@line-crm/line-sdk";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { runInBackground } from "../middleware/background.js";
import type { CacheService } from "../services/cache.service.js";
import { fireEvent } from "../services/event-bus.js";
import { shouldTrigger } from "../services/matchers.js";
import { buildMessage, expandVariables } from "../services/step-delivery.js";

const TIME_COMMAND_PATTERN = /(?:配信時間|配信|届けて|通知)[はを]?\s*\d{1,2}\s*時/;
const TIME_EXTRACT_PATTERN = /(?:配信時間|配信|届けて|通知)[はを]?\s*(\d{1,2})\s*時/;

/**
 * Deliver the first step of a scenario immediately via replyMessage,
 * then advance or complete the friend_scenario record.
 */
async function deliverFirstStepImmediately(
	db: Database,
	friendRepo: ReturnType<typeof createFriendRepository>,
	lineClient: LineClient,
	replyToken: string,
	friendScenarioId: string,
	friend: { id: string; displayName: string | null; userId: string | null },
	scenario: {
		id: string;
		steps: Array<{ id: string; delayMinutes: number; messageType: string; messageContent: string; stepOrder: number }>;
	},
	lineUserId: string,
): Promise<void> {
	const firstStep = scenario.steps[0];
	if (!firstStep || firstStep.delayMinutes !== 0) return;

	const expandedContent = expandVariables(firstStep.messageContent, {
		id: friend.id,
		display_name: friend.displayName,
		user_id: friend.userId,
	});
	const message = buildMessage(firstStep.messageType, expandedContent);
	await lineClient.replyMessage(replyToken, [message]);
	console.log(`Immediate delivery: sent step ${firstStep.id} to ${lineUserId}`);

	// Log outgoing message (replyMessage = free)
	await friendRepo.logMessage({
		friendId: friend.id,
		direction: "outgoing",
		messageType: firstStep.messageType,
		content: firstStep.messageContent,
		scenarioStepId: firstStep.id,
		deliveryType: "reply",
	});

	// Advance or complete the friend_scenario
	await advanceOrCompleteScenario(db, friendScenarioId, scenario.steps, firstStep);
}

/**
 * After immediate delivery: advance to the next step or mark scenario as completed.
 */
async function advanceOrCompleteScenario(
	db: Database,
	friendScenarioId: string,
	steps: Array<{ delayMinutes: number; stepOrder: number }>,
	firstStep: { stepOrder: number },
): Promise<void> {
	const now = DateTime.now().toISO();
	const secondStep = steps[1] ?? null;

	if (secondStep) {
		const nextDeliveryDate = new Date(Date.now() + 9 * 60 * 60_000);
		nextDeliveryDate.setMinutes(nextDeliveryDate.getMinutes() + secondStep.delayMinutes);
		// Enforce 9:00-21:00 JST delivery window
		const h = nextDeliveryDate.getUTCHours();
		if (h < 9 || h >= 21) {
			if (h >= 21) nextDeliveryDate.setUTCDate(nextDeliveryDate.getUTCDate() + 1);
			nextDeliveryDate.setUTCHours(9, 0, 0, 0);
		}
		await db
			.update(friendScenarios)
			.set({
				currentStepOrder: firstStep.stepOrder,
				nextDeliveryAt: `${nextDeliveryDate.toISOString().slice(0, -1)}+09:00`,
				updatedAt: now,
			})
			.where(eq(friendScenarios.id, friendScenarioId));
	} else {
		await db
			.update(friendScenarios)
			.set({ status: "completed", nextDeliveryAt: null, updatedAt: now })
			.where(eq(friendScenarios.id, friendScenarioId));
	}
}

/**
 * Enroll a friend in matching friend_add scenarios and deliver the first step immediately if applicable.
 */
async function enrollFriendAddScenarios(
	db: Database,
	friendRepo: ReturnType<typeof createFriendRepository>,
	scenarioRepo: ReturnType<typeof createScenarioRepository>,
	lineClient: LineClient,
	replyToken: string,
	friend: { id: string; displayName: string | null; userId: string | null },
	lineUserId: string,
	lineAccountId: string | null,
): Promise<void> {
	const scenarioList = await scenarioRepo.list();
	for (const scenario of scenarioList) {
		const scenarioForMatcher = {
			id: scenario.id,
			triggerType: scenario.triggerType,
			triggerTagId: scenario.triggerTagId ?? null,
			lineAccountId: scenario.lineAccountId ?? null,
			isActive: scenario.isActive,
			deletedAt: scenario.deletedAt ?? null,
		};
		if (!shouldTrigger(scenarioForMatcher, "friend_add", lineAccountId)) continue;

		try {
			const [existing] = await db
				.select({ id: friendScenarios.id })
				.from(friendScenarios)
				.where(and(eq(friendScenarios.friendId, friend.id), eq(friendScenarios.scenarioId, scenario.id)));
			if (existing) continue;

			const friendScenarioId = await scenarioRepo.enrollFriend(friend.id as FriendId, scenario.id as ScenarioId, null);

			try {
				await deliverFirstStepImmediately(
					db,
					friendRepo,
					lineClient,
					replyToken,
					friendScenarioId,
					friend,
					scenario,
					lineUserId,
				);
			} catch (err) {
				console.error("Failed immediate delivery for scenario", scenario.id, err);
			}
		} catch (err) {
			console.error("Failed to enroll friend in scenario", scenario.id, err);
		}
	}
}

const webhook = new Hono<Env>();

webhook.post("/webhook", async (c) => {
	const rawBody = await c.req.text();
	const signature = c.req.header("X-Line-Signature") ?? "";
	const db = c.get("db");
	const cache = c.get("cache");

	let body: WebhookRequestBody;
	try {
		body = JSON.parse(rawBody) as WebhookRequestBody;
	} catch {
		console.error("Failed to parse webhook body");
		return c.json({ status: "ok" }, 200);
	}

	// Multi-account: resolve credentials from DB by destination (channel user ID)
	// or fall back to environment variables (default account)
	let channelSecret = c.env.LINE_CHANNEL_SECRET;
	let channelAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
	let matchedAccountId: string | null = null;

	if ((body as { destination?: string }).destination) {
		const accounts = await db.select().from(lineAccounts).orderBy(desc(lineAccounts.createdAt));
		for (const account of accounts) {
			if (!account.isActive) continue;
			const isValid = await verifySignature(account.channelSecret, rawBody, signature);
			if (isValid) {
				channelSecret = account.channelSecret;
				channelAccessToken = account.channelAccessToken;
				matchedAccountId = account.id;
				break;
			}
		}
	}

	// Verify with resolved secret (skip if already verified in the multi-account loop)
	if (!matchedAccountId) {
		const valid = await verifySignature(channelSecret, rawBody, signature);
		if (!valid) {
			console.error("Invalid LINE signature");
			return c.json({ status: "ok" }, 200);
		}
	}

	const lineClient = new LineClient(channelAccessToken);

	// 非同期処理 — LINE は ~1s 以内のレスポンスを要求
	// runInBackground wraps waitUntil with error logging and labels
	runInBackground(
		c,
		async () => {
			for (const event of body.events) {
				try {
					await handleEvent(
						db,
						c.env.DB,
						lineClient,
						event,
						channelAccessToken,
						matchedAccountId,
						c.env.WORKER_URL || new URL(c.req.url).origin,
						cache,
					);
				} catch (err) {
					console.error("Error handling webhook event:", err);
				}
			}
		},
		"webhook-event-processing",
	);

	return c.json({ status: "ok" }, 200);
});

/** Handle follow event: upsert friend, enroll in scenarios, fire event */
async function handleFollowEvent(
	db: Database,
	rawDb: D1Database,
	lineClient: LineClient,
	event: WebhookEvent & { type: "follow"; replyToken: string },
	lineAccessToken: string,
	lineAccountId: string | null,
	cache?: CacheService,
): Promise<void> {
	const friendRepo = createFriendRepository(db);
	const scenarioRepo = createScenarioRepository(db);

	const userId = event.source.type === "user" ? event.source.userId : undefined;
	if (!userId) return;

	let profile: Awaited<ReturnType<typeof lineClient.getProfile>> | undefined;
	try {
		if (cache) {
			const cacheKey = cache.lineProfile.key(userId);
			profile = await cache.getOrFetch(cacheKey, () => lineClient.getProfile(userId), { ttl: cache.lineProfile.ttl });
		} else {
			profile = await lineClient.getProfile(userId);
		}
	} catch (err) {
		console.error("Failed to get profile for", userId, err);
	}

	await friendRepo.upsert({
		lineUserId: userId as LineUserId,
		displayName: profile?.displayName ?? null,
		pictureUrl: profile?.pictureUrl ?? null,
		statusMessage: profile?.statusMessage ?? null,
		lineAccountId: (lineAccountId ?? undefined) as LineAccountId | undefined,
	});
	const friend = await friendRepo.findByLineUserId(userId as LineUserId);
	if (!friend) return;

	if (lineAccountId) {
		await db
			.update(friends)
			.set({ lineAccountId: lineAccountId })
			.where(and(eq(friends.id, friend.id), isNull(friends.lineAccountId)));
	}

	await enrollFriendAddScenarios(
		db,
		friendRepo,
		scenarioRepo,
		lineClient,
		event.replyToken,
		friend,
		userId,
		lineAccountId,
	);

	await fireEvent(
		rawDb,
		"friend_add",
		{ friendId: friend.id, eventData: { displayName: friend.displayName } },
		lineAccessToken,
		lineAccountId,
	);
}

/** Handle group/room text message: upsert group chat, resolve sender, log, auto-reply */
async function handleGroupTextMessage(
	db: Database,
	rawDb: D1Database,
	lineClient: LineClient,
	event: WebhookEvent & {
		type: "message";
		replyToken: string;
		source: { type: "group" | "room"; userId?: string; groupId?: string; roomId?: string };
	},
	incomingText: string,
	lineAccessToken: string,
	lineAccountId: string | null,
	workerUrl?: string,
): Promise<void> {
	const friendRepo = createFriendRepository(db);
	const groupChatRepo = createGroupChatRepository(db);
	const sourceType = event.source.type;
	const groupId = sourceType === "group" ? event.source.groupId : event.source.roomId;
	const senderUserId = event.source.userId;

	await groupChatRepo.upsertGroupChat({
		sourceType,
		groupId: sourceType === "group" ? groupId : undefined,
		roomId: sourceType === "room" ? groupId : undefined,
		groupName: "Unknown Group",
	});

	let friend = null;
	if (senderUserId) {
		friend = await friendRepo.findByLineUserId(senderUserId as LineUserId);
		if (!friend && groupId) {
			try {
				const memberProfile =
					sourceType === "group"
						? await lineClient.getGroupMemberProfile(groupId, senderUserId)
						: await lineClient.getRoomMemberProfile(groupId, senderUserId);
				await friendRepo.upsert({
					lineUserId: senderUserId as LineUserId,
					displayName: memberProfile.displayName ?? null,
					pictureUrl: memberProfile.pictureUrl ?? null,
					statusMessage: null,
				});
				friend = await friendRepo.findByLineUserId(senderUserId as LineUserId);
			} catch (err) {
				console.error("Failed to get group member profile for", senderUserId, err);
			}
		}
	}

	if (friend) {
		await friendRepo.logMessage({
			friendId: friend.id,
			direction: "incoming",
			messageType: "text",
			content: incomingText,
		});
	}

	await handleAutoReply(
		db,
		lineClient,
		event.replyToken,
		incomingText,
		friend ? { id: friend.id, display_name: friend.displayName, user_id: friend.userId } : null,
		lineAccountId,
		workerUrl,
	);

	await fireEvent(
		rawDb,
		"group_message_received",
		{ friendId: friend?.id, eventData: { text: incomingText, groupId, sourceType } },
		lineAccessToken,
		lineAccountId,
	);
}

/** Handle preferred delivery time command: save to metadata and reply with confirmation */
async function handleTimeCommand(
	friendRepo: ReturnType<typeof createFriendRepository>,
	lineClient: LineClient,
	replyToken: string,
	friendId: string,
	incomingText: string,
): Promise<boolean> {
	const timeMatch = incomingText.match(TIME_EXTRACT_PATTERN);
	if (!timeMatch) return false;

	const hour = parseInt(timeMatch[1], 10);
	if (hour < 6 || hour > 22) return false;

	const typedFriendId = friendId as import("@line-crm/domain").FriendId;
	const existing = await friendRepo.getMetadata(typedFriendId);
	const meta = { ...(existing ?? {}), preferred_hour: hour };
	await friendRepo.updateMetadata(typedFriendId, meta);

	try {
		const period = hour < 12 ? "午前" : "午後";
		const displayHour = hour <= 12 ? hour : hour - 12;
		await lineClient.replyMessage(replyToken, [
			buildMessage(
				"flex",
				JSON.stringify({
					type: "bubble",
					body: {
						type: "box",
						layout: "vertical",
						contents: [
							{ type: "text", text: "配信時間を設定しました", size: "lg", weight: "bold", color: "#1e293b" },
							{
								type: "box",
								layout: "vertical",
								contents: [
									{
										type: "text",
										text: `${period} ${displayHour}:00`,
										size: "xxl",
										weight: "bold",
										color: "#f59e0b",
										align: "center",
									},
									{
										type: "text",
										text: `（${hour}:00〜）`,
										size: "sm",
										color: "#64748b",
										align: "center",
										margin: "sm",
									},
								],
								backgroundColor: "#fffbeb",
								cornerRadius: "md",
								paddingAll: "20px",
								margin: "lg",
							},
							{
								type: "text",
								text: "今後のステップ配信はこの時間以降にお届けします。",
								size: "xs",
								color: "#64748b",
								wrap: true,
								margin: "lg",
							},
						],
						paddingAll: "20px",
					},
				}),
			),
		]);
	} catch (err) {
		console.error("Failed to reply for time setting", err);
	}
	return true;
}

/** Handle cross-account trigger: send notification to the same user on other LINE accounts */
async function handleCrossAccountTrigger(
	db: Database,
	lineClient: LineClient,
	replyToken: string,
	friend: { id: string; displayName: string | null },
	lineAccountId: string,
): Promise<boolean> {
	try {
		const [friendRecord] = await db.select({ userId: friends.userId }).from(friends).where(eq(friends.id, friend.id));
		if (!friendRecord?.userId) return false;

		const otherFriendsFiltered = await db
			.select({ lineUserId: friends.lineUserId, channelAccessToken: lineAccounts.channelAccessToken })
			.from(friends)
			.innerJoin(lineAccounts, eq(lineAccounts.id, friends.lineAccountId))
			.where(
				and(
					eq(friends.userId, friendRecord.userId),
					ne(friends.lineAccountId, lineAccountId),
					eq(friends.isFollowing, true),
				),
			);

		for (const other of otherFriendsFiltered) {
			const otherClient = new LineClient(other.channelAccessToken);
			const { buildMessage: bm } = await import("../services/step-delivery.js");
			await otherClient.pushMessage(other.lineUserId, [
				bm(
					"flex",
					JSON.stringify({
						type: "bubble",
						size: "giga",
						header: {
							type: "box",
							layout: "vertical",
							paddingAll: "20px",
							backgroundColor: "#fffbeb",
							contents: [
								{
									type: "text",
									text: `${friend.displayName ?? ""}さんへ`,
									size: "lg",
									weight: "bold",
									color: "#1e293b",
								},
							],
						},
						body: {
							type: "box",
							layout: "vertical",
							paddingAll: "20px",
							contents: [
								{
									type: "text",
									text: "別アカウントからのアクションを検知しました。",
									size: "sm",
									color: "#06C755",
									weight: "bold",
									wrap: true,
								},
								{
									type: "text",
									text: "アカウント連携が正常に動作しています。体験ありがとうございました。",
									size: "sm",
									color: "#1e293b",
									wrap: true,
									margin: "md",
								},
								{ type: "separator", margin: "lg" },
								{
									type: "text",
									text: "ステップ配信・フォーム即返信・アカウント連携・リッチメニュー・自動返信 — 全て無料、全てOSS。",
									size: "xs",
									color: "#64748b",
									wrap: true,
									margin: "lg",
								},
							],
						},
						footer: {
							type: "box",
							layout: "vertical",
							paddingAll: "16px",
							contents: [
								{
									type: "button",
									action: { type: "message", label: "導入について相談する", text: "導入支援を希望します" },
									style: "primary",
									color: "#06C755",
								},
								{
									type: "button",
									action: {
										type: "uri",
										label: "フィードバックを送る",
										uri: "https://liff.line.me/2009554425-4IMBmLQ9?page=form&id=0c81910a-fe27-41a7-bf8c-1411a9240155",
									},
									style: "secondary",
									margin: "sm",
								},
							],
						},
					}),
				),
			]);
		}

		await lineClient.replyMessage(replyToken, [
			buildMessage(
				"flex",
				JSON.stringify({
					type: "bubble",
					body: {
						type: "box",
						layout: "vertical",
						paddingAll: "20px",
						contents: [
							{
								type: "text",
								text: "Account ① にメッセージを送りました",
								size: "sm",
								color: "#06C755",
								weight: "bold",
								align: "center",
							},
							{
								type: "text",
								text: "Account ① のトーク画面を確認してください",
								size: "xs",
								color: "#64748b",
								align: "center",
								margin: "md",
							},
						],
					},
				}),
			),
		]);
		return true;
	} catch (err) {
		console.error("Cross-account trigger error:", err);
		return false;
	}
}

/** Handle 1:1 direct text message: log, chat upsert, time command, cross-account, auto-reply */
async function handleDirectTextMessage(
	db: Database,
	rawDb: D1Database,
	lineClient: LineClient,
	event: WebhookEvent & { type: "message"; replyToken: string; source: { type: "user"; userId: string } },
	incomingText: string,
	lineAccessToken: string,
	lineAccountId: string | null,
	workerUrl?: string,
): Promise<void> {
	const friendRepo = createFriendRepository(db);
	const chatRepo = createChatRepository(db);
	const userId = event.source.userId;

	const friend = await friendRepo.findByLineUserId(userId as LineUserId);
	if (!friend) return;

	await friendRepo.logMessage({
		friendId: friend.id,
		direction: "incoming",
		messageType: "text",
		content: incomingText,
	});

	// Upsert chat only for organic messages (exclude auto-keyword and time commands)
	const autoKeywords = [
		"料金",
		"機能",
		"API",
		"フォーム",
		"ヘルプ",
		"UUID",
		"UUID連携について教えて",
		"UUID連携を確認",
		"配信時間",
		"導入支援を希望します",
		"アカウント連携を見る",
		"体験を完了する",
		"BAN対策を見る",
		"連携確認",
	];
	const isAutoKeyword = autoKeywords.some((k) => incomingText === k);
	const isTimeCommand = TIME_COMMAND_PATTERN.test(incomingText);
	if (!(isAutoKeyword || isTimeCommand)) {
		await chatRepo.upsertOnMessage(friend.id as FriendId);
	}

	// Preferred delivery time
	const timeHandled = await handleTimeCommand(friendRepo, lineClient, event.replyToken, friend.id, incomingText);
	if (timeHandled) return;

	// Cross-account trigger
	if (incomingText === "体験を完了する" && lineAccountId) {
		const handled = await handleCrossAccountTrigger(db, lineClient, event.replyToken, friend, lineAccountId);
		if (handled) return;
	}

	// Auto-reply
	const autoReplyMatched = await handleAutoReply(
		db,
		lineClient,
		event.replyToken,
		incomingText,
		{ id: friend.id, display_name: friend.displayName, user_id: friend.userId },
		lineAccountId,
		workerUrl,
	);

	await fireEvent(
		rawDb,
		"message_received",
		{ friendId: friend.id, eventData: { text: incomingText, matched: autoReplyMatched } },
		lineAccessToken,
		lineAccountId,
	);
}

async function handleEvent(
	db: Database,
	rawDb: D1Database,
	lineClient: LineClient,
	event: WebhookEvent,
	lineAccessToken: string,
	lineAccountId: string | null = null,
	workerUrl?: string,
	cache?: CacheService,
): Promise<void> {
	if (event.type === "follow") {
		await handleFollowEvent(db, rawDb, lineClient, event as FollowEvent, lineAccessToken, lineAccountId, cache);
		return;
	}

	if (event.type === "unfollow") {
		const userId = event.source.type === "user" ? event.source.userId : undefined;
		if (!userId) return;
		const friendRepo = createFriendRepository(db);
		const friend = await friendRepo.findByLineUserId(userId as LineUserId);
		if (friend) await friendRepo.setUnfollowed(friend.id as FriendId);
		return;
	}

	if (event.type === "join") {
		await handleJoinEvent(db, rawDb, lineClient, event, lineAccessToken, lineAccountId);
		return;
	}

	if (event.type === "leave") {
		await handleLeaveEvent(db, rawDb, lineClient, event, lineAccessToken, lineAccountId);
		return;
	}

	if (event.type === "message" && event.message.type === "text") {
		const textMessage = event.message as TextEventMessage;
		const sourceType = event.source.type;
		const incomingText = textMessage.text;

		if (sourceType === "group" || sourceType === "room") {
			await handleGroupTextMessage(
				db,
				rawDb,
				lineClient,
				event as MessageEvent & { source: GroupSource | RoomSource },
				incomingText,
				lineAccessToken,
				lineAccountId,
				workerUrl,
			);
			return;
		}

		if (sourceType === "user") {
			await handleDirectTextMessage(
				db,
				rawDb,
				lineClient,
				event as MessageEvent & { source: { type: "user"; userId: string } },
				incomingText,
				lineAccessToken,
				lineAccountId,
				workerUrl,
			);
			return;
		}
	}
}

/** Handle bot joining a group/room */
async function handleJoinEvent(
	db: Database,
	rawDb: D1Database,
	lineClient: LineClient,
	event: JoinEvent,
	lineAccessToken: string,
	lineAccountId: string | null,
): Promise<void> {
	const groupChatRepo = createGroupChatRepository(db);
	const source = event.source;
	const sourceType = source.type;
	const groupId = source.type === "group" ? source.groupId : source.roomId;
	if (!groupId) return;

	let groupName = "Unknown Group";
	let groupPictureUrl: string | null = null;
	if (sourceType === "group") {
		try {
			const summary = await lineClient.getGroupSummary(groupId);
			groupName = summary.groupName;
			groupPictureUrl = summary.pictureUrl ?? null;
		} catch (err) {
			console.error("Failed to fetch group summary for", groupId, err);
		}
	}

	await groupChatRepo.upsertGroupChat({
		sourceType,
		groupId: sourceType === "group" ? groupId : undefined,
		roomId: sourceType === "room" ? groupId : undefined,
		groupName,
		groupPictureUrl,
	});

	console.log(`Bot joined ${sourceType}: ${groupId} (${groupName})`);
	await fireEvent(
		rawDb,
		"group_join",
		{ friendId: undefined, eventData: { sourceType, groupId, groupName } },
		lineAccessToken,
		lineAccountId,
	);
}

/** Handle bot leaving a group/room */
async function handleLeaveEvent(
	db: Database,
	rawDb: D1Database,
	_lineClient: LineClient,
	event: LeaveEvent,
	lineAccessToken: string,
	lineAccountId: string | null,
): Promise<void> {
	const groupChatRepo = createGroupChatRepository(db);
	const source = event.source;
	const sourceType = source.type;
	const groupId = source.type === "group" ? source.groupId : source.roomId;
	if (!groupId) return;

	const existingChat =
		sourceType === "group" ? await groupChatRepo.findByGroupId(groupId) : await groupChatRepo.findByRoomId(groupId);
	if (existingChat) {
		const now = DateTime.now().toISO();
		await db.update(chats).set({ status: "resolved", updatedAt: now }).where(eq(chats.id, existingChat.id));
	}
	console.log(`Bot left ${sourceType}: ${groupId}`);
	await fireEvent(
		rawDb,
		"group_leave",
		{ friendId: undefined, eventData: { sourceType, groupId } },
		lineAccessToken,
		lineAccountId,
	);
}

// ─── 自動返信ヘルパー（1:1 + グループ共用） ───────────────────────────────────
/**
 * 自動返信ルールを照合し、マッチした場合は replyMessage で返信する。
 * Multi-message 対応: auto_reply_messages テーブルから messageOrder 順に
 * 最大5メッセージ（DOMAIN_LIMITS.maxAutoReplyMessages）を取得し配列で返信。
 * auto_reply_messages が空の場合はレガシーの responseContent を使用。
 */
async function handleAutoReply(
	db: Database,
	lineClient: LineClient,
	replyToken: string,
	incomingText: string,
	friend: { id: string; display_name: string | null; user_id: string | null } | null,
	lineAccountId: string | null,
	workerUrl?: string,
): Promise<boolean> {
	// NOTE: Auto-replies use replyMessage (free, no quota) instead of pushMessage
	// The replyToken is only valid for ~1 minute after the message event
	const autoReplyRepo = createAutoReplyRepository(db);
	const friendRepo = createFriendRepository(db);
	const matched = await autoReplyRepo.findMatchingReplies(incomingText, lineAccountId);

	if (!matched) return false;

	const { rule, messages: childMessages } = matched;

	try {
		// Build reply messages array (multi-message or legacy single)
		let replyMessages: ReturnType<typeof buildMessage>[];
		let logEntries: Array<{ message_type: string; message_content: string }>;

		if (childMessages.length > 0) {
			replyMessages = childMessages.map((msg) => {
				const expandedContent = friend ? expandVariables(msg.messageContent, friend, workerUrl) : msg.messageContent;
				return buildMessage(msg.messageType, expandedContent);
			});
			logEntries = childMessages.map((msg) => ({
				message_type: msg.messageType,
				message_content: msg.messageContent,
			}));
		} else {
			// Backward compat: use legacy responseContent/responseType
			const expandedContent = friend ? expandVariables(rule.responseContent, friend, workerUrl) : rule.responseContent;
			replyMessages = [buildMessage(rule.responseType, expandedContent)];
			logEntries = [{ message_type: rule.responseType, message_content: rule.responseContent }];
		}

		await lineClient.replyMessage(replyToken, replyMessages);

		// 送信ログ（replyMessage = 無料）— 並列INSERT
		if (friend) {
			await Promise.all(
				logEntries.map((entry) =>
					friendRepo.logMessage({
						friendId: friend.id,
						direction: "outgoing",
						messageType: entry.message_type,
						content: entry.message_content,
						deliveryType: "reply",
					}),
				),
			);
		}
	} catch (err) {
		console.error("Failed to send auto-reply", err);
	}
	return true;
}

export { webhook };
