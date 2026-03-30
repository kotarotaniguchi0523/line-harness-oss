// =============================================================================
// Scoring Repository - Drizzle ORM
// =============================================================================

import type { FriendId, ScoringRuleId } from "@line-crm/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../drizzle.js";
import { friendScores, friends, scoringRules } from "../schema/index.js";
import { DateTime } from "../utils.js";

export function createScoringRepository(db: Database) {
	const ruleColumns = {
		id: scoringRules.id,
		name: scoringRules.name,
		eventType: scoringRules.eventType,
		scoreValue: scoringRules.scoreValue,
		isActive: scoringRules.isActive,
		createdAt: scoringRules.createdAt,
		updatedAt: scoringRules.updatedAt,
	} as const;

	const scoreLogColumns = {
		id: friendScores.id,
		friendId: friendScores.friendId,
		scoringRuleId: friendScores.scoringRuleId,
		scoreChange: friendScores.scoreChange,
		reason: friendScores.reason,
		createdAt: friendScores.createdAt,
	} as const;

	return {
		/** Find a scoring rule by ID */
		async findRuleById(id: ScoringRuleId) {
			const [row] = await db.select(ruleColumns).from(scoringRules).where(eq(scoringRules.id, id));
			return row ?? null;
		},

		/** Get the cached score for a friend */
		async getFriendScore(friendId: FriendId): Promise<number> {
			const [row] = await db.select({ score: friends.score }).from(friends).where(eq(friends.id, friendId));
			return row?.score ?? 0;
		},

		/** List all scoring rules, newest first */
		async listRules() {
			return db.select(ruleColumns).from(scoringRules).orderBy(desc(scoringRules.createdAt));
		},

		/** Create a new scoring rule, returns the generated ID */
		async createRule(data: { name: string; eventType: string; scoreValue: number }): Promise<string> {
			const id = crypto.randomUUID();
			await db.insert(scoringRules).values({
				id,
				name: data.name,
				eventType: data.eventType,
				scoreValue: data.scoreValue,
			});
			return id;
		},

		/** Partial update of a scoring rule */
		async updateRule(
			id: ScoringRuleId,
			updates: Partial<{
				name: string;
				eventType: string;
				scoreValue: number;
				isActive: boolean;
			}>,
		): Promise<void> {
			const setClause: Record<string, unknown> = {};
			if (updates.name !== undefined) setClause.name = updates.name;
			if (updates.eventType !== undefined) setClause.eventType = updates.eventType;
			if (updates.scoreValue !== undefined) setClause.scoreValue = updates.scoreValue;
			if (updates.isActive !== undefined) setClause.isActive = updates.isActive;

			if (Object.keys(setClause).length === 0) return;
			setClause.updatedAt = DateTime.now().toISO();

			await db.update(scoringRules).set(setClause).where(eq(scoringRules.id, id));
		},

		/** Hard-delete a scoring rule */
		async deleteRule(id: ScoringRuleId): Promise<void> {
			await db.delete(scoringRules).where(eq(scoringRules.id, id));
		},

		/** Record a score change for a friend and update the cached score on friends */
		async addScore(data: {
			friendId: FriendId;
			scoringRuleId?: ScoringRuleId;
			scoreChange: number;
			reason?: string;
		}): Promise<void> {
			const id = crypto.randomUUID();
			await db.insert(friendScores).values({
				id,
				friendId: data.friendId,
				scoringRuleId: data.scoringRuleId ?? null,
				scoreChange: data.scoreChange,
				reason: data.reason ?? null,
			});

			// Update cached score on friends table
			await db
				.update(friends)
				.set({
					score: sql`${friends.score} + ${data.scoreChange}`,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(friends.id, data.friendId));
		},

		/**
		 * Apply all active scoring rules matching an event type to a friend (batch).
		 * Returns the total score change applied.
		 */
		async applyScore(friendId: FriendId, eventType: string): Promise<number> {
			const activeRules = await db
				.select(ruleColumns)
				.from(scoringRules)
				.where(and(eq(scoringRules.eventType, eventType), eq(scoringRules.isActive, true)));

			if (activeRules.length === 0) return 0;

			let totalChange = 0;
			for (const rule of activeRules) {
				const id = crypto.randomUUID();
				await db.insert(friendScores).values({
					id,
					friendId,
					scoringRuleId: rule.id,
					scoreChange: rule.scoreValue,
					reason: `${eventType} -> ${rule.name}`,
				});
				totalChange += rule.scoreValue;
			}

			// Update cached score on friends table
			await db
				.update(friends)
				.set({
					score: sql`${friends.score} + ${totalChange}`,
					updatedAt: DateTime.now().toISO(),
				})
				.where(eq(friends.id, friendId));

			return totalChange;
		},

		/** Get score history for a friend */
		async getScoreHistory(friendId: FriendId) {
			return db
				.select(scoreLogColumns)
				.from(friendScores)
				.where(eq(friendScores.friendId, friendId))
				.orderBy(desc(friendScores.createdAt));
		},

		/** Get active rules matching an event type */
		async getActiveRulesByEvent(eventType: string) {
			return db
				.select(ruleColumns)
				.from(scoringRules)
				.where(and(eq(scoringRules.eventType, eventType), eq(scoringRules.isActive, true)));
		},
	};
}
