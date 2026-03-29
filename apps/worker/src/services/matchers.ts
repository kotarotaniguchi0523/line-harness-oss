// =============================================================================
// Matchers — 性質ベースのマッチング (純粋関数、副作用なし)
//
// シナリオマッチングと自動返信マッチングを統合したモジュール。
// 性質 (property) と状態 (state) を明確に分離し、関数名で意図を表現する。
//
// Scenario matcher:
// - matchesTriggerType(): 性質チェック — シナリオの不変な定義情報に基づく判定
// - isExecutable(): 状態チェック — シナリオの変化する実行情報に基づく判定
// - shouldTrigger(): 合成 — 性質マッチ AND 状態OK の複合判定
//
// Auto-reply matcher:
// - matchesKeyword(): 性質チェック — ルールのキーワード定義に基づく判定
// - isRuleActive(): 状態チェック — ルールの有効/無効状態に基づく判定
// - shouldReply(): 合成 — 性質マッチ AND 状態OK の複合判定
// =============================================================================

import type { AutoReplyMatchType, ScenarioTriggerType } from "@line-crm/contracts";

// ---------------------------------------------------------------------------
// Scenario matcher types
// ---------------------------------------------------------------------------

/** シナリオの性質 (不変な定義情報) */
export interface ScenarioMatchInput {
	readonly id: string;
	readonly triggerType: string;
	readonly triggerTagId: string | null;
	readonly lineAccountId: string | null;
}

/** シナリオの状態 (変化する実行情報) */
export interface ScenarioMatchState {
	readonly isActive: boolean;
	readonly deletedAt: string | null;
}

/** シナリオ全体 = 性質 + 状態 */
export interface ScenarioWithState extends ScenarioMatchInput, ScenarioMatchState {}

// ---------------------------------------------------------------------------
// Auto-reply matcher types
// ---------------------------------------------------------------------------

/** 自動返信ルールの性質 (キーワードとマッチ方式の定義) */
export interface AutoReplyConfig {
	readonly keyword: string;
	readonly matchType: AutoReplyMatchType;
}

/** 自動返信ルールの状態 (有効/無効の実行情報) */
export interface AutoReplyState {
	readonly isActive: boolean;
}

/** 自動返信ルール全体 = 性質 + 状態 */
export interface AutoReplyWithState extends AutoReplyConfig, AutoReplyState {}

// =============================================================================
// Scenario matcher — 性質ベースの判定 (Pure functions — no I/O)
// =============================================================================

/**
 * このシナリオは指定トリガータイプに反応する性質を持つか。
 * シナリオの triggerType フィールドと webhook イベントのトリガータイプを照合する。
 */
export function matchesTriggerType(scenario: ScenarioMatchInput, triggerType: ScenarioTriggerType): boolean {
	return scenario.triggerType === triggerType;
}

/**
 * このシナリオは指定LINEアカウントに属する性質を持つか。
 * アカウント未指定のシナリオは全アカウントにマッチする (後方互換)。
 */
export function matchesAccount(scenario: ScenarioMatchInput, lineAccountId: string | null): boolean {
	if (!(scenario.lineAccountId && lineAccountId)) return true;
	return scenario.lineAccountId === lineAccountId;
}

/**
 * このシナリオは指定タグに反応する性質を持つか。
 * tag_added トリガーのシナリオで、特定のタグIDと照合する場合に使用。
 */
export function matchesTag(scenario: ScenarioMatchInput, tagId: string): boolean {
	return scenario.triggerTagId === tagId;
}

/**
 * 性質ベースのフルマッチ: トリガータイプ + アカウントの両方を検証。
 * webhook イベント受信時のプライマリフィルタとして使用する。
 */
export function matchesEvent(
	scenario: ScenarioMatchInput,
	triggerType: ScenarioTriggerType,
	lineAccountId: string | null,
): boolean {
	return matchesTriggerType(scenario, triggerType) && matchesAccount(scenario, lineAccountId);
}

/**
 * このシナリオは現在実行可能な状態か。
 * アクティブであり、かつ論理削除されていないことを検証する。
 */
export function isExecutable(scenario: ScenarioMatchState): boolean {
	return scenario.isActive && !scenario.deletedAt;
}

/**
 * このシナリオはイベントに反応すべきか (性質マッチ AND 状態OK)。
 * webhook ハンドラから呼び出すメインエントリーポイント。
 *
 * 判定順序:
 * 1. matchesEvent() — トリガータイプ + アカウントの性質マッチ
 * 2. isExecutable() — アクティブかつ未削除の状態チェック
 */
export function shouldTrigger(
	scenario: ScenarioWithState,
	triggerType: ScenarioTriggerType,
	lineAccountId: string | null,
): boolean {
	return matchesEvent(scenario, triggerType, lineAccountId) && isExecutable(scenario);
}

// =============================================================================
// Auto-reply matcher — キーワードマッチング (Pure functions — no I/O)
// =============================================================================

// ---------------------------------------------------------------------------
// マッチタイプごとの判定戦略マップ
//
// switch/if チェーンではなくオブジェクトマップで拡張性を確保。
// 新しいマッチタイプ (e.g., "regex", "starts_with") を追加する場合は
// このマップにエントリーを追加するだけで済む。
// ---------------------------------------------------------------------------

type MatchStrategy = (keyword: string, text: string) => boolean;

const MATCH_STRATEGIES: Record<AutoReplyMatchType, MatchStrategy> = {
	exact: (keyword, text) => text === keyword,
	contains: (keyword, text) => text.includes(keyword),
};

/**
 * 受信テキストがこのルールのキーワードにマッチするか。
 * matchType に応じて完全一致または部分一致で判定する。
 *
 * サポートするマッチタイプ:
 * - "exact": テキスト全体がキーワードと完全一致
 * - "contains": テキストにキーワードが部分文字列として含まれる
 *
 * 未知の matchType の場合は安全側に倒して false を返す。
 */
export function matchesKeyword(config: AutoReplyConfig, text: string): boolean {
	const strategy = MATCH_STRATEGIES[config.matchType];
	if (!strategy) return false;
	return strategy(config.keyword, text);
}

/**
 * この自動返信ルールは現在有効な状態か。
 * 管理画面から無効化されたルールを除外するために使用する。
 */
export function isRuleActive(state: AutoReplyState): boolean {
	return state.isActive;
}

/**
 * この自動返信ルールは受信テキストに対して返信すべきか。
 * ルールが有効 (状態) かつキーワードがマッチ (性質) する場合に true。
 *
 * 判定順序:
 * 1. isRuleActive() — ルールが有効かの状態チェック (軽量、先に実行)
 * 2. matchesKeyword() — キーワードマッチの性質チェック
 */
export function shouldReply(rule: AutoReplyWithState, text: string): boolean {
	return isRuleActive(rule) && matchesKeyword(rule, text);
}
