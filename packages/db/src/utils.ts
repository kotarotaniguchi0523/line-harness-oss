// =============================================================================
// DateTime — dayjs ベースの宣言的な日時 Value Object
// =============================================================================
// 内部状態として dayjs インスタンスを保持。
// 全メソッドは不変（immutable）で新しい DateTime を返す。
// DB への保存は必ず `.toISO()` で JST ISO 8601 文字列に変換する。
// `DateTime.now()` がプロジェクト唯一の「現在時刻取得」ポイント。

import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

/** プロジェクト標準タイムゾーン */
const PROJECT_TZ = "Asia/Tokyo" as const;

/** DB 保存用フォーマット (ISO 8601 with offset) */
const ISO_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSSZ" as const;

/**
 * 宣言的な DateTime Value Object。
 *
 * - 全メソッドは純粋関数（immutable: 元の値を変えない）
 * - 内部は dayjs インスタンス（常に Asia/Tokyo）
 * - DB 保存は `.toISO()` で JST ISO 8601 文字列
 * - 比較は `.isBefore()`, `.isAfter()`, `.isSame()` で型安全
 */
export class DateTime {
	private constructor(private readonly inner: dayjs.Dayjs) {}

	// ---------------------------------------------------------------------------
	// Constructors (static factory methods)
	// ---------------------------------------------------------------------------

	/** 現在時刻 (JST) */
	static now(): DateTime {
		return new DateTime(dayjs().tz(PROJECT_TZ));
	}

	/** ISO 文字列からパース */
	static fromISO(iso: string): DateTime {
		return new DateTime(dayjs(iso).tz(PROJECT_TZ));
	}

	/** Date オブジェクトから変換 */
	static fromDate(date: Date): DateTime {
		return new DateTime(dayjs(date).tz(PROJECT_TZ));
	}

	/** Unix ミリ秒から変換 */
	static fromUnixMs(ms: number): DateTime {
		return new DateTime(dayjs(ms).tz(PROJECT_TZ));
	}

	/** Unix 秒から変換 */
	static fromUnix(seconds: number): DateTime {
		return new DateTime(dayjs.unix(seconds).tz(PROJECT_TZ));
	}

	// ---------------------------------------------------------------------------
	// Serialization (for DB storage / API response)
	// ---------------------------------------------------------------------------

	/** JST ISO 8601 文字列 (DB 保存用) — e.g. "2025-03-27T15:30:00.000+09:00" */
	toISO(): string {
		return this.inner.format(ISO_FORMAT);
	}

	/** Unix ミリ秒 */
	toUnixMs(): number {
		return this.inner.valueOf();
	}

	/** Unix 秒 */
	toUnix(): number {
		return this.inner.unix();
	}

	/** Date オブジェクト */
	toDate(): Date {
		return this.inner.toDate();
	}

	/** YYYYMMDD 形式 (LINE API delivery result 用) */
	toDateString(): string {
		return this.inner.format("YYYYMMDD");
	}

	/** YYYYMMDD HHmmss +0900 形式 (Yahoo Ads Conversion 用) */
	toYahooFormat(): string {
		return this.inner.format("YYYYMMDD HHmmss +0900");
	}

	/** 表示用 (日本語ロケール) */
	toDisplay(): string {
		return this.inner.format("YYYY年MM月DD日 HH:mm");
	}

	// ---------------------------------------------------------------------------
	// Immutable operations (returns new DateTime)
	// ---------------------------------------------------------------------------

	/** N 分後 */
	addMinutes(n: number): DateTime {
		return new DateTime(this.inner.add(n, "minute"));
	}

	/** N 時間後 */
	addHours(n: number): DateTime {
		return new DateTime(this.inner.add(n, "hour"));
	}

	/** N 日後 */
	addDays(n: number): DateTime {
		return new DateTime(this.inner.add(n, "day"));
	}

	/** N 分前 */
	subtractMinutes(n: number): DateTime {
		return new DateTime(this.inner.subtract(n, "minute"));
	}

	/** N 日前 */
	subtractDays(n: number): DateTime {
		return new DateTime(this.inner.subtract(n, "day"));
	}

	/** 時刻を指定（時, 分, 秒） — 同日内で時刻だけ変更 */
	setTime(hour: number, minute = 0, second = 0): DateTime {
		return new DateTime(this.inner.hour(hour).minute(minute).second(second).millisecond(0));
	}

	/** 翌日の指定時刻 */
	nextDayAt(hour: number, minute = 0): DateTime {
		return this.addDays(1).setTime(hour, minute);
	}

	// ---------------------------------------------------------------------------
	// Comparison (pure predicates)
	// ---------------------------------------------------------------------------

	/** this < other */
	isBefore(other: DateTime): boolean {
		return this.inner.isBefore(other.inner);
	}

	/** this > other */
	isAfter(other: DateTime): boolean {
		return this.inner.isAfter(other.inner);
	}

	/** this === other (同一ミリ秒) */
	isSame(other: DateTime): boolean {
		return this.inner.isSame(other.inner);
	}

	/** this <= other */
	isBeforeOrSame(other: DateTime): boolean {
		return this.inner.isBefore(other.inner) || this.inner.isSame(other.inner);
	}

	/** 配信可能時間帯内か (9:00-21:00 JST) */
	isInDeliveryWindow(): boolean {
		const h = this.inner.hour();
		return h >= 9 && h < 21;
	}

	/** 次の配信可能時刻を返す（現在が時間外なら翌朝9:00） */
	nextDeliveryWindow(): DateTime {
		if (this.isInDeliveryWindow()) return this;
		const h = this.inner.hour();
		if (h >= 21) return this.nextDayAt(9);
		return this.setTime(9);
	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	get hour(): number {
		return this.inner.hour();
	}

	get minute(): number {
		return this.inner.minute();
	}

	get dayOfWeek(): number {
		return this.inner.day();
	}

	// ---------------------------------------------------------------------------
	// Static utilities
	// ---------------------------------------------------------------------------

	/** 2つの DateTime の差（ミリ秒） */
	static diffMs(a: DateTime, b: DateTime): number {
		return a.toUnixMs() - b.toUnixMs();
	}

	/** 期限切れ判定（指定日数以内に期限切れ） */
	static expiresWithinDays(expiresAt: string, days: number): boolean {
		const expiry = DateTime.fromISO(expiresAt);
		const threshold = DateTime.now().addDays(days);
		return expiry.isBefore(threshold);
	}
}

// ---------------------------------------------------------------------------
// Legacy compat (段階的に DateTime.now().toISO() に移行)
// ---------------------------------------------------------------------------

/** @deprecated Use `DateTime.now().toISO()` instead */
export function jstNow(): string {
	return DateTime.now().toISO();
}

/** @deprecated Use `DateTime.fromDate(date).toISO()` instead */
export function toJstString(date: Date): string {
	return DateTime.fromDate(date).toISO();
}

/** @deprecated Use `DateTime.fromISO(a).isBefore(DateTime.fromISO(b))` instead */
export function isTimeBefore(a: string, b: string): boolean {
	return DateTime.fromISO(a).isBeforeOrSame(DateTime.fromISO(b));
}
