// =============================================================================
// Account Store — 性質 (Config) と 状態 (State) の分離
// =============================================================================
// LINE アカウント管理における2つの関心事を明確に分離する:
//
// 性質 (Config): LineAccountIdentity — サーバーから取得、ローカルで不変
//   - id, channelId はアカウント作成時に決定され変わらない
//   - name はアカウント設定であり、頻繁には変わらない
//   - isActive はアカウントの有効性であり、管理者操作でのみ変化
//   → TanStack Query が管理 (useSuspenseQuery + queryKey ["lineAccounts"])
//   → Store には保持しない
//
// 状態 (State): AccountSelectionState — ユーザー操作で変動
//   - selectedAccountId はユーザーがアカウントを切り替えるたびに変化
//   - sessionStorage に永続化 (タブ単位で独立、セキュリティ上安全)
//   → TanStack Store が管理
//
// Usage:
//   import { accountSelectionStore, selectAccount } from "@/stores/account.store";
//   import type { LineAccountIdentity } from "@/stores/account.store";
//
//   // Store の状態を React で利用:
//   const selectedId = useStore(accountSelectionStore, (s) => s.selectedAccountId);
//
//   // アカウント一覧は TanStack Query で取得:
//   const { data } = useSuspenseQuery(queryOptionsConfig.lineAccounts.list());
// =============================================================================

import { Store } from "@tanstack/store";

// ---------------------------------------------------------------------------
// 性質 (Config): LINE アカウント識別情報
// ---------------------------------------------------------------------------
// サーバーから取得されるアカウントデータの型定義。
// TanStack Query がキャッシュ・再取得を管理するため、
// Store には格納しない。型定義のみエクスポートする。
//
// readonly 修飾子により、コンポーネント側での誤った変更を防ぐ。
// サーバーデータの変更は必ず API 経由 → Query 再取得の流れで行う。

export interface LineAccountIdentity {
	readonly id: string;
	readonly channelId: string;
	readonly name: string;
	readonly isActive: boolean;
}

// ---------------------------------------------------------------------------
// 状態 (State): UI 選択状態
// ---------------------------------------------------------------------------
// ユーザーがアカウントスイッチャーで選択した ID を保持する。
// sessionStorage に永続化することで、ページリロード時にも選択を維持。
//
// なぜ sessionStorage か:
// - localStorage: タブ間で共有 → 別タブで別アカウント操作時に干渉
// - sessionStorage: タブ単位で独立 → 並行作業に適している
// - cookie: サーバーに送信される → 不要なオーバーヘッド

export interface AccountSelectionState {
	selectedAccountId: string | null;
}

const SESSION_STORAGE_KEY = "lh_selected_account";

/**
 * sessionStorage から選択済みアカウント ID を復元する。
 * SSR 環境 (window が存在しない) では null を返す。
 */
function loadSelectedAccount(): string | null {
	if (typeof window === "undefined") return null;
	return sessionStorage.getItem(SESSION_STORAGE_KEY);
}

/**
 * アカウント選択状態を管理する TanStack Store。
 *
 * アカウント一覧 (LineAccountIdentity[]) は含まない。
 * 一覧データは TanStack Query の queryKey ["lineAccounts"] で管理し、
 * このストアは「どのアカウントが選択されているか」のみを責務とする。
 */
export const accountSelectionStore = new Store<AccountSelectionState>({
	selectedAccountId: loadSelectedAccount(),
});

/**
 * アカウントを選択し、sessionStorage に永続化する。
 *
 * @param id - 選択する LINE アカウントの UUID
 *
 * @example
 * ```typescript
 * // アカウントスイッチャーの onChange で呼び出す
 * selectAccount(account.id);
 * ```
 */
export function selectAccount(id: string): void {
	if (typeof window !== "undefined") {
		sessionStorage.setItem(SESSION_STORAGE_KEY, id);
	}
	accountSelectionStore.setState(() => ({ selectedAccountId: id }));
}

/**
 * アカウント選択をクリアする。
 * ログアウト時やアカウント削除時に使用。
 */
export function clearAccountSelection(): void {
	if (typeof window !== "undefined") {
		sessionStorage.removeItem(SESSION_STORAGE_KEY);
	}
	accountSelectionStore.setState(() => ({ selectedAccountId: null }));
}
