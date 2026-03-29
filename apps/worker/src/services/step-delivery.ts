import {
	advanceFriendScenario,
	completeFriendScenario,
	createDb,
	createFriendRepository,
	createTagRepository,
	DateTime,
	getFriendById,
	getFriendScenariosDueForDelivery,
	getScenarioSteps,
} from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import type { FriendId } from "@line-crm/domain";
import type { LineClient } from "@line-crm/line-sdk";
import { buildMessage } from "./message-builder.js";
import { addJitter, jitterDeliveryTime, sleep } from "./stealth.js";

// =============================================================================
// Condition Evaluator — inlined from condition-evaluator.ts
//
// Dispatch-table based step condition evaluation. Each evaluator reads from DB
// and returns a boolean. No side effects beyond the read.
// =============================================================================

type ConditionEvaluator = (db: D1Database, friendId: string, value: string) => Promise<boolean>;

async function friendHasTag(db: D1Database, friendId: string, tagId: string): Promise<boolean> {
	const drizzle = createDb(db);
	const tagRepo = createTagRepository(drizzle);
	const friendTags = await tagRepo.getByFriend(friendId as FriendId);
	return friendTags.some((t) => t.id === tagId);
}

async function getFriendMetadata(db: D1Database, friendId: string): Promise<Record<string, unknown>> {
	const drizzle = createDb(db);
	const friendRepo = createFriendRepository(drizzle);
	const friend = await friendRepo.findById(friendId as FriendId);
	return JSON.parse(friend?.metadata || "{}") as Record<string, unknown>;
}

const conditionEvaluators: Record<string, ConditionEvaluator> = {
	tag_exists: async (db, friendId, tagId) => {
		return friendHasTag(db, friendId, tagId);
	},

	tag_not_exists: async (db, friendId, tagId) => {
		const has = await friendHasTag(db, friendId, tagId);
		return !has;
	},

	metadata_equals: async (db, friendId, json) => {
		const { key, value } = JSON.parse(json) as { key: string; value: unknown };
		const metadata = await getFriendMetadata(db, friendId);
		return metadata[key] === value;
	},

	metadata_not_equals: async (db, friendId, json) => {
		const { key, value } = JSON.parse(json) as { key: string; value: unknown };
		const metadata = await getFriendMetadata(db, friendId);
		return metadata[key] !== value;
	},
};

/**
 * Evaluate a step condition using the dispatch table.
 * - type / value が null なら無条件で true (条件なし)
 * - 未知の条件タイプは true を返す (安全側に倒す)
 */
async function evaluateCondition(
	db: D1Database,
	friendId: string,
	step: { condition_type: string | null; condition_value: string | null },
): Promise<boolean> {
	if (!(step.condition_type && step.condition_value)) return true;

	const evaluator = conditionEvaluators[step.condition_type];
	return evaluator ? evaluator(db, friendId, step.condition_value) : true;
}

/**
 * Replace template variables in message content.
 *
 * Supported variables:
 * - {{name}}                → friend's display name
 * - {{uid}}                 → friend's user UUID
 * - {{friend_id}}           → friend's internal ID
 * - {{auth_url:CHANNEL_ID}} → full /auth/line URL with uid for cross-account linking
 */
export function expandVariables(
	content: string,
	friend: { id: string; display_name: string | null; user_id: string | null; ref_code?: string | null },
	apiOrigin?: string,
): string {
	let result = content;
	result = result.replace(/\{\{name\}\}/g, friend.display_name ?? "");
	result = result.replace(/\{\{uid\}\}/g, friend.user_id ?? "");
	result = result.replace(/\{\{friend_id\}\}/g, friend.id);
	result = result.replace(/\{\{ref\}\}/g, friend.ref_code ?? "");
	// Conditional block: {{#if_ref}}...{{/if_ref}} — only shown if ref_code exists
	if (friend.ref_code) {
		result = result.replace(/\{\{#if_ref\}\}([\s\S]*?)\{\{\/if_ref\}\}/g, "$1");
	} else {
		result = result.replace(/\{\{#if_ref\}\}[\s\S]*?\{\{\/if_ref\}\}/g, "");
	}
	if (apiOrigin) {
		result = result.replace(/\{\{auth_url:([^}]+)\}\}/g, (_match, channelId) => {
			const params = new URLSearchParams({ account: channelId, ref: "cross-link" });
			if (friend.user_id) params.set("uid", friend.user_id);
			return `${apiOrigin}/auth/line?${params.toString()}`;
		});
	}
	return result;
}

/** Default delivery window: 9:00-23:00 JST. If outside, push to next 9:00 AM. */
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 23;

function enforceDeliveryWindow(date: Date, preferredHour?: number): Date {
	// date is already shifted to JST epoch (+9h)
	const hours = date.getUTCHours();
	const startHour = preferredHour ?? DEFAULT_START_HOUR;
	const endHour = DEFAULT_END_HOUR;

	if (hours >= startHour && hours < endHour) return date;

	// Outside window: push to next preferred start hour
	const result = new Date(date);
	if (hours >= endHour) {
		result.setUTCDate(result.getUTCDate() + 1);
	}
	result.setUTCHours(startHour, 0, 0, 0);
	return result;
}

export async function processStepDeliveries(db: D1Database, lineClient: LineClient, workerUrl?: string): Promise<void> {
	// Skip delivery outside 9:00-23:00 JST window
	const jstHour = new Date(Date.now() + 9 * 60 * 60_000).getUTCHours();
	if (jstHour < DEFAULT_START_HOUR || jstHour >= DEFAULT_END_HOUR) return;

	const now = DateTime.now().toISO();
	const dueFriendScenarios = await getFriendScenariosDueForDelivery(db, now);

	for (let i = 0; i < dueFriendScenarios.length; i++) {
		const fs = dueFriendScenarios[i];
		try {
			// Stealth: add small random delay between deliveries to avoid burst patterns
			if (i > 0) {
				await sleep(addJitter(50, 200));
			}
			await processSingleDelivery(db, lineClient, fs, workerUrl);
		} catch (err) {
			console.error(`Error processing friend_scenario ${fs.id}:`, err);
			// Continue with next one
		}
	}
}

async function processSingleDelivery(
	db: D1Database,
	lineClient: LineClient,
	fs: {
		id: string;
		friend_id: string;
		scenario_id: string;
		current_step_order: number;
		status: string;
		next_delivery_at: string | null;
	},
	workerUrl?: string,
): Promise<void> {
	// Get friend first to read preferred delivery hour from metadata
	const friend = await getFriendById(db, fs.friend_id);
	if (!friend?.is_following) {
		await completeFriendScenario(db, fs.id);
		return;
	}
	const metadata = JSON.parse((friend as { metadata?: string }).metadata || "{}") as Record<string, unknown>;
	const preferredHour = typeof metadata.preferred_hour === "number" ? metadata.preferred_hour : undefined;

	// Get all steps for this scenario
	const steps = await getScenarioSteps(db, fs.scenario_id);
	if (steps.length === 0) {
		await completeFriendScenario(db, fs.id);
		return;
	}

	// Steps are sorted by step_order but may not be contiguous (e.g., 1, 3, 5 after deletions).
	// Find the next step whose step_order > current_step_order.
	const currentStep = steps.find((s) => s.step_order > fs.current_step_order);

	if (!currentStep) {
		await completeFriendScenario(db, fs.id);
		return;
	}

	// Check step condition before sending
	if (currentStep.condition_type) {
		const conditionMet = await evaluateCondition(db, fs.friend_id, currentStep);
		if (!conditionMet) {
			if (currentStep.next_step_on_false !== null && currentStep.next_step_on_false !== undefined) {
				const jumpStep = steps.find((s) => s.step_order === currentStep.next_step_on_false);
				if (jumpStep) {
					const nextDate = new Date(Date.now() + 9 * 60 * 60_000);
					nextDate.setMinutes(nextDate.getMinutes() + jumpStep.delay_minutes);
					const windowedDate = enforceDeliveryWindow(nextDate, preferredHour);
					const jitteredDate = jitterDeliveryTime(windowedDate);
					await advanceFriendScenario(
						db,
						fs.id,
						currentStep.step_order,
						`${jitteredDate.toISOString().slice(0, -1)}+09:00`,
					);
					return;
				}
			}
			const nextIndex = steps.indexOf(currentStep) + 1;
			if (nextIndex < steps.length) {
				const nextStep = steps[nextIndex];
				const nextDate = new Date(Date.now() + 9 * 60 * 60_000);
				nextDate.setMinutes(nextDate.getMinutes() + nextStep.delay_minutes);
				const windowedDate = enforceDeliveryWindow(nextDate, preferredHour);
				const jitteredDate = jitterDeliveryTime(windowedDate);
				await advanceFriendScenario(
					db,
					fs.id,
					currentStep.step_order,
					`${jitteredDate.toISOString().slice(0, -1)}+09:00`,
				);
			} else {
				await completeFriendScenario(db, fs.id);
			}
			return;
		}
	}

	// Expand template variables ({{name}}, {{uid}}, {{auth_url:CHANNEL_ID}}, etc.)
	const expandedContent = expandVariables(currentStep.message_content, friend, workerUrl);
	// Auto-wrap URLs with tracking links (text with URLs → Flex with button)
	let trackedType: string = currentStep.message_type;
	let trackedContent = expandedContent;
	if (workerUrl) {
		const { autoTrackContent } = await import("./auto-track.js");
		const tracked = await autoTrackContent(db, currentStep.message_type, expandedContent, workerUrl);
		trackedType = tracked.messageType;
		trackedContent = tracked.content;
	}
	const message = buildMessage(trackedType, trackedContent);
	await lineClient.pushMessage(friend.line_user_id, [message]);

	// Log outgoing message
	const drizzle = createDb(db);
	await drizzle.insert(messagesLog).values({
		id: crypto.randomUUID(),
		friendId: friend.id,
		direction: "outgoing",
		messageType: currentStep.message_type,
		content: currentStep.message_content,
		broadcastId: null,
		scenarioStepId: currentStep.id,
	});

	// Determine next step (find the step after currentStep in the sorted list)
	const currentIndex = steps.indexOf(currentStep);
	const nextStep = currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null;

	if (nextStep) {
		// Schedule next delivery with stealth jitter + delivery window enforcement
		const nextDeliveryDate = new Date(Date.now() + 9 * 60 * 60_000);
		nextDeliveryDate.setMinutes(nextDeliveryDate.getMinutes() + nextStep.delay_minutes);
		const windowedDate = enforceDeliveryWindow(nextDeliveryDate, preferredHour);
		const jitteredDate = jitterDeliveryTime(windowedDate);
		await advanceFriendScenario(db, fs.id, currentStep.step_order, `${jitteredDate.toISOString().slice(0, -1)}+09:00`);
	} else {
		// This was the last step
		await completeFriendScenario(db, fs.id);
	}
}

// Re-export buildMessage for backward compatibility (webhook.ts, friends.ts, forms.ts, liff.ts import from here)
export { buildMessage } from "./message-builder.js";
