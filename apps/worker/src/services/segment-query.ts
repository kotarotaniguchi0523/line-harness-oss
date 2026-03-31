import { and, eq, exists, not, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@line-crm/db";
import { friends, friendTags } from "@line-crm/db/schema";

export interface SegmentRule {
	type: "tag_exists" | "tag_not_exists" | "metadata_equals" | "metadata_not_equals" | "ref_code" | "is_following";
	value: string | boolean | { key: string; value: string };
}

export interface SegmentCondition {
	operator: "AND" | "OR";
	rules: SegmentRule[];
}

function validateMetadataValue(value: SegmentRule["value"]): { key: string; value: string } {
	if (
		typeof value !== "object" ||
		value === null ||
		typeof (value as { key: string; value: string }).key !== "string" ||
		typeof (value as { key: string; value: string }).value !== "string"
	) {
		throw new Error("metadata rule requires { key: string; value: string }");
	}
	return value as { key: string; value: string };
}

function buildRuleCondition(rule: SegmentRule): SQL {
	switch (rule.type) {
		case "tag_exists": {
			if (typeof rule.value !== "string") throw new Error("tag_exists rule requires a string tag ID value");
			return exists(
				sql`SELECT 1 FROM ${friendTags} WHERE ${friendTags.friendId} = ${friends.id} AND ${friendTags.tagId} = ${rule.value}`,
			);
		}
		case "tag_not_exists": {
			if (typeof rule.value !== "string") throw new Error("tag_not_exists rule requires a string tag ID value");
			return not(
				exists(
					sql`SELECT 1 FROM ${friendTags} WHERE ${friendTags.friendId} = ${friends.id} AND ${friendTags.tagId} = ${rule.value}`,
				),
			);
		}
		case "metadata_equals": {
			const mv = validateMetadataValue(rule.value);
			return sql`json_extract(${friends.metadata}, ${`$.${mv.key}`}) = ${mv.value}`;
		}
		case "metadata_not_equals": {
			const mv = validateMetadataValue(rule.value);
			return sql`(json_extract(${friends.metadata}, ${`$.${mv.key}`}) IS NULL OR json_extract(${friends.metadata}, ${`$.${mv.key}`}) != ${mv.value})`;
		}
		case "ref_code": {
			if (typeof rule.value !== "string") throw new Error("ref_code rule requires a string value");
			return sql`${friends.metadata} IS NOT NULL AND json_extract(${friends.metadata}, '$.ref_code') = ${rule.value}`;
		}
		case "is_following": {
			if (typeof rule.value !== "boolean") throw new Error("is_following rule requires a boolean value");
			return eq(friends.isFollowing, rule.value);
		}
		default: {
			const exhaustive: never = rule.type;
			throw new Error(`Unknown segment rule type: ${exhaustive}`);
		}
	}
}

export function buildSegmentWhere(condition: SegmentCondition): SQL | undefined {
	if (condition.rules.length === 0) return undefined;

	const conditions = condition.rules.map(buildRuleCondition);

	if (condition.operator === "AND") {
		return and(...conditions);
	}
	return or(...conditions);
}

export async function executeSegmentQuery(
	db: Database,
	condition: SegmentCondition,
): Promise<{ id: string; lineUserId: string }[]> {
	const where = buildSegmentWhere(condition);

	return db
		.select({ id: friends.id, lineUserId: friends.lineUserId })
		.from(friends)
		.where(where);
}
