/**
 * Cross-module Drizzle relations that would otherwise create circular imports.
 *
 * friendsRelations was originally in crm.ts but required importing from
 * scenarios.ts and scoring.ts, which both import from crm.ts -- creating cycles.
 * Moving it here breaks the cycle while keeping the relation metadata intact.
 */
import { relations } from "drizzle-orm";
import { friends, friendTags, messagesLog } from "./crm.js";
import { friendScenarios } from "./scenarios.js";
import { friendScores } from "./scoring.js";

export const friendsRelations = relations(friends, ({ many }) => ({
	tags: many(friendTags),
	scenarios: many(friendScenarios),
	scores: many(friendScores),
	messagesLog: many(messagesLog),
}));
