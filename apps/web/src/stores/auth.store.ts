// =============================================================================
// Auth — better-auth セッションが SSOT (Single Source of Truth)
// =============================================================================
// このファイルは auth-client.ts の useSession() を SSOT とし、
// TanStack Store による冗長な状態管理を排除する。
//
// 性質 (Config): staffProfile — セッション内で不変な識別情報
//   - id, name, email はセッション確立時に決定され、以降変わらない
//   - better-auth が httpOnly cookie で管理するため、ローカル状態は不要
//
// 状態 (State): isAuthenticated — セッション有効性で変動
//   - cookie の有無・有効期限で動的に変化する
//   - better-auth の getSession() / useSession() が判定するため、
//     TanStack Store で二重管理する必要がない
//
// 結論: 両方とも better-auth が管理するため、ローカルストアは不要。
// auth-client.ts の re-export と、UI が参照する型定義のみ提供する。
//
// Usage:
//   import { authClient, type AuthSession } from "@/stores/auth.store";
//   const session = await authClient.getSession();
//   // React コンポーネント内:
//   const { data: session, isPending } = authClient.useSession();
// =============================================================================

// Re-export for convenience — 既存の import パスを維持
export { authClient } from "../lib/auth-client";

// ---------------------------------------------------------------------------
// UI が直接参照する型 (better-auth のセッション型から導出)
// ---------------------------------------------------------------------------
// better-auth の Session 型は内部的に複雑なため、
// UI コンポーネントが必要とする最小限のインターフェースを定義する。
// これにより better-auth の内部型変更に対するバッファとなる。

/**
 * 性質: ユーザー識別情報 (セッション内で不変)
 * better-auth のセッションから取得される、変更されない属性群。
 */
export interface AuthUser {
	readonly id: string;
	readonly name: string;
	readonly email: string;
}

/**
 * UI コンポーネントが参照するセッション型。
 * better-auth の getSession() / useSession() の戻り値から
 * 必要なフィールドのみを抽出した型。
 */
export interface AuthSession {
	readonly user: AuthUser;
}

/**
 * 認証状態の判定ヘルパー。
 * better-auth の getSession() 結果を受け取り、型安全に判定する。
 *
 * @example
 * ```typescript
 * const result = await authClient.getSession();
 * if (isAuthenticated(result.data)) {
 *   // result.data は AuthSession として利用可能
 *   console.log(result.data.user.name);
 * }
 * ```
 */
export function isAuthenticated(
	session: { user: { id: string; name: string; email: string } } | null | undefined,
): session is AuthSession {
	return session != null && typeof session.user?.id === "string";
}
