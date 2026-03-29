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

function buildRuleClause(rule: SegmentRule): { clause: string; params: unknown[] } {
	switch (rule.type) {
		case "tag_exists": {
			if (typeof rule.value !== "string") {
				throw new Error("tag_exists rule requires a string tag ID value");
			}
			return {
				clause: "EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)",
				params: [rule.value],
			};
		}
		case "tag_not_exists": {
			if (typeof rule.value !== "string") {
				throw new Error("tag_not_exists rule requires a string tag ID value");
			}
			return {
				clause: "NOT EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)",
				params: [rule.value],
			};
		}
		case "metadata_equals": {
			const mv = validateMetadataValue(rule.value);
			return { clause: "json_extract(f.metadata, ?) = ?", params: [`$.${mv.key}`, mv.value] };
		}
		case "metadata_not_equals": {
			const mv = validateMetadataValue(rule.value);
			return {
				clause: "(json_extract(f.metadata, ?) IS NULL OR json_extract(f.metadata, ?) != ?)",
				params: [`$.${mv.key}`, `$.${mv.key}`, mv.value],
			};
		}
		case "ref_code": {
			if (typeof rule.value !== "string") {
				throw new Error("ref_code rule requires a string value");
			}
			return { clause: "f.ref_code = ?", params: [rule.value] };
		}
		case "is_following": {
			if (typeof rule.value !== "boolean") {
				throw new Error("is_following rule requires a boolean value");
			}
			return { clause: "f.is_following = ?", params: [rule.value ? 1 : 0] };
		}
		default: {
			const exhaustive: never = rule.type;
			throw new Error(`Unknown segment rule type: ${exhaustive}`);
		}
	}
}

export function buildSegmentQuery(condition: SegmentCondition): { sql: string; bindings: unknown[] } {
	const bindings: unknown[] = [];
	const clauses: string[] = [];

	for (const rule of condition.rules) {
		const { clause, params } = buildRuleClause(rule);
		clauses.push(clause);
		bindings.push(...params);
	}

	const separator = condition.operator === "AND" ? " AND " : " OR ";
	const where = clauses.length > 0 ? clauses.join(separator) : "1=1";
	const sql = `SELECT f.id, f.line_user_id FROM friends f WHERE ${where}`;

	return { sql, bindings };
}
