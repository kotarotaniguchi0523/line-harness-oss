import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useTransition } from "react";
import { z } from "zod";
import { css } from "../../../styled-system/css";
import { queryOptionsConfig } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

// ---------------------------------------------------------------------------
// Route definition with URL-based state (no useState for server-derived state)
// ---------------------------------------------------------------------------
const friendsSearchSchema = z.object({
	page: z.number().int().positive().default(1).catch(1),
	tagId: z.string().default("").catch(""),
});

export const Route = createFileRoute("/_authed/friends")({
	validateSearch: friendsSearchSchema,
	// Prefetch friend list + tags in route loader for instant rendering
	loader: async ({ context: { queryClient }, search: { page, tagId } }) => {
		const PAGE_SIZE = 20;
		const params = new URLSearchParams({
			limit: String(PAGE_SIZE),
			offset: String((page - 1) * PAGE_SIZE),
		});
		if (tagId) params.set("tagId", tagId);

		await Promise.all([
			queryClient.ensureQueryData({
				...queryOptionsConfig.friends.list({ page, tagId }),
				queryFn: () => fetchApi<{ success: true; data: FriendListResponse }>(`/api/friends?${params}`),
			}),
			queryClient.ensureQueryData({
				...queryOptionsConfig.tags.list(),
				queryFn: () => fetchApi<{ success: true; data: TagItem[] }>("/api/tags"),
			}),
		]);
	},
	component: FriendsPage,
});

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Route Component (orchestrates Suspense boundaries)
// ---------------------------------------------------------------------------
function FriendsPage() {
	const { page, tagId } = Route.useSearch();

	return (
		<div>
			<h1 className={css({ mb: "6", fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>友だち管理</h1>

			<Suspense fallback={<FilterSkeleton />}>
				<TagFilter currentTagId={tagId} />
			</Suspense>

			<Suspense fallback={<TableSkeleton />}>
				<FriendTable page={page} tagId={tagId} />
			</Suspense>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Container: Tag Filter (fetches tags, delegates rendering)
// ---------------------------------------------------------------------------
function TagFilter({ currentTagId }: { currentTagId: string }) {
	const navigate = Route.useNavigate();
	const [isPending, startTransition] = useTransition();
	const { data } = useSuspenseQuery({
		...queryOptionsConfig.tags.list(),
		queryFn: () => fetchApi<{ success: true; data: TagItem[] }>("/api/tags"),
	});

	return (
		<div className={css({ mb: "4", display: "flex", alignItems: "center", gap: "2" })}>
			<label className={css({ fontSize: "sm", color: "gray.600", display: "flex", alignItems: "center", gap: "2" })}>
				タグで絞り込み:
				<select
					className={css({
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "gray.300",
						px: "3",
						py: "2",
						fontSize: "sm",
					})}
					value={currentTagId}
					disabled={isPending}
					onChange={(e) => {
						startTransition(() => {
							navigate({ search: { tagId: e.target.value, page: 1 } });
						});
					}}
				>
					<option value="">すべて</option>
					{data.data.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
			</label>
			{isPending && <span className={css({ fontSize: "xs", color: "gray.400" })}>読み込み中...</span>}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Container: Friend Table (fetches friends, delegates rendering)
// ---------------------------------------------------------------------------
function FriendTable({ page, tagId }: { page: number; tagId: string }) {
	const navigate = Route.useNavigate();
	const [isPending, startTransition] = useTransition();

	const { data } = useSuspenseQuery({
		...queryOptionsConfig.friends.list({ page, tagId }),
		queryFn: () => {
			const params = new URLSearchParams({
				limit: String(PAGE_SIZE),
				offset: String((page - 1) * PAGE_SIZE),
			});
			if (tagId) params.set("tagId", tagId);
			return fetchApi<{ success: true; data: FriendListResponse }>(`/api/friends?${params}`);
		},
	});

	const { items, total, hasNextPage } = data.data;

	if (items.length === 0) {
		return <EmptyState message="友だちがいません。" />;
	}

	const goToPage = (p: number) => {
		startTransition(() => {
			navigate({ search: (prev) => ({ ...prev, page: p }) });
		});
	};

	return (
		<>
			<p className={css({ mb: "2", fontSize: "sm", color: "gray.500" })}>{total.toLocaleString("ja-JP")} 件</p>

			<div
				className={css({
					overflowX: "auto",
					borderRadius: "lg",
					borderWidth: "1px",
					borderColor: "gray.200",
					bg: "white",
					shadow: "sm",
					opacity: isPending ? "0.6" : "1",
				})}
			>
				<table className={css({ minW: "full", divideY: "1px", divideColor: "gray.200" })}>
					<thead className={css({ bg: "gray.50" })}>
						<tr>
							<th
								className={css({
									px: "4",
									py: "3",
									textAlign: "left",
									fontSize: "xs",
									fontWeight: "medium",
									textTransform: "uppercase",
									color: "gray.500",
								})}
							>
								名前
							</th>
							<th
								className={css({
									px: "4",
									py: "3",
									textAlign: "left",
									fontSize: "xs",
									fontWeight: "medium",
									textTransform: "uppercase",
									color: "gray.500",
								})}
							>
								タグ
							</th>
							<th
								className={css({
									px: "4",
									py: "3",
									textAlign: "left",
									fontSize: "xs",
									fontWeight: "medium",
									textTransform: "uppercase",
									color: "gray.500",
								})}
							>
								スコア
							</th>
							<th
								className={css({
									px: "4",
									py: "3",
									textAlign: "left",
									fontSize: "xs",
									fontWeight: "medium",
									textTransform: "uppercase",
									color: "gray.500",
								})}
							>
								状態
							</th>
							<th
								className={css({
									px: "4",
									py: "3",
									textAlign: "left",
									fontSize: "xs",
									fontWeight: "medium",
									textTransform: "uppercase",
									color: "gray.500",
								})}
							>
								登録日
							</th>
						</tr>
					</thead>
					<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
						{items.map((friend) => (
							<FriendRow key={friend.id} friend={friend} />
						))}
					</tbody>
				</table>
			</div>

			{total > PAGE_SIZE && (
				<Pagination page={page} total={total} pageSize={PAGE_SIZE} hasNextPage={hasNextPage} onPageChange={goToPage} />
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// Presentation Components (pure, no data fetching)
// ---------------------------------------------------------------------------
function FriendRow({ friend }: { friend: FriendItem }) {
	return (
		<tr className={css({ _hover: { bg: "gray.50" } })}>
			<td className={css({ px: "4", py: "3" })}>
				<div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
					<Avatar src={friend.pictureUrl} name={friend.displayName} />
					<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>
						{friend.displayName ?? "—"}
					</span>
				</div>
			</td>
			<td className={css({ px: "4", py: "3" })}>
				<div className={css({ display: "flex", flexWrap: "wrap", gap: "1" })}>
					{friend.tags?.map((tag) => (
						<TagBadge key={tag.id} name={tag.name} color={tag.color} />
					))}
				</div>
			</td>
			<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.600" })}>{friend.score}</td>
			<td className={css({ px: "4", py: "3" })}>
				<StatusBadge isFollowing={friend.isFollowing} />
			</td>
			<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.500" })}>
				{new Date(friend.createdAt).toLocaleDateString("ja-JP")}
			</td>
		</tr>
	);
}

function Avatar({ src, name }: { src: FriendState["pictureUrl"]; name: FriendState["displayName"] }) {
	if (src) return <img src={src} alt="" className={css({ h: "8", w: "8", borderRadius: "full" })} />;
	return (
		<div
			className={css({
				display: "flex",
				h: "8",
				w: "8",
				alignItems: "center",
				justifyContent: "center",
				borderRadius: "full",
				bg: "gray.200",
				fontSize: "xs",
				color: "gray.500",
			})}
		>
			{name?.charAt(0) ?? "?"}
		</div>
	);
}

function TagBadge({ name, color }: { name: string; color: string }) {
	return (
		<span
			className={css({
				display: "inline-flex",
				borderRadius: "full",
				px: "2",
				py: "0.5",
				fontSize: "xs",
				fontWeight: "medium",
				color: "white",
			})}
			style={{ backgroundColor: color }}
		>
			{name}
		</span>
	);
}

function StatusBadge({ isFollowing }: Pick<FriendState, "isFollowing">) {
	return (
		<span
			className={css({
				display: "inline-flex",
				borderRadius: "full",
				px: "2",
				py: "0.5",
				fontSize: "xs",
				fontWeight: "medium",
				bg: isFollowing ? "green.100" : "gray.100",
				color: isFollowing ? "green.700" : "gray.600",
			})}
		>
			{isFollowing ? "フォロー中" : "ブロック"}
		</span>
	);
}

function Pagination({
	page,
	total,
	pageSize,
	hasNextPage,
	onPageChange,
}: {
	page: number;
	total: number;
	pageSize: number;
	hasNextPage: boolean;
	onPageChange: (p: number) => void;
}) {
	return (
		<div className={css({ mt: "4", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
			<p className={css({ fontSize: "sm", color: "gray.500" })}>
				{(page - 1) * pageSize + 1}〜{Math.min(page * pageSize, total)} 件 / 全{total}件
			</p>
			<div className={css({ display: "flex", gap: "2" })}>
				<button
					type="button"
					onClick={() => onPageChange(Math.max(1, page - 1))}
					disabled={page <= 1}
					className={css({
						minH: "11",
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "gray.300",
						px: "3",
						py: "2",
						fontSize: "sm",
						_disabled: { opacity: "0.5" },
					})}
				>
					前へ
				</button>
				<span className={css({ display: "flex", alignItems: "center", px: "3", fontSize: "sm", color: "gray.700" })}>
					{page}
				</span>
				<button
					type="button"
					onClick={() => onPageChange(page + 1)}
					disabled={!hasNextPage}
					className={css({
						minH: "11",
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "gray.300",
						px: "3",
						py: "2",
						fontSize: "sm",
						_disabled: { opacity: "0.5" },
					})}
				>
					次へ
				</button>
			</div>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div
			className={css({
				borderRadius: "lg",
				borderWidth: "1px",
				borderColor: "gray.200",
				bg: "white",
				p: "8",
				textAlign: "center",
				fontSize: "sm",
				color: "gray.500",
			})}
		>
			{message}
		</div>
	);
}

function FilterSkeleton() {
	return <div className={css({ mb: "4", h: "10", w: "64", animation: "pulse", borderRadius: "lg", bg: "gray.200" })} />;
}

function TableSkeleton() {
	return (
		<div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
			{Array.from({ length: 5 }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
					key={i}
					className={css({
						display: "flex",
						animation: "pulse",
						alignItems: "center",
						gap: "4",
						borderBottomWidth: "1px",
						borderColor: "gray.100",
						px: "4",
						py: "4",
					})}
				>
					<div className={css({ h: "10", w: "10", borderRadius: "full", bg: "gray.200" })} />
					<div className={css({ flex: "1", display: "flex", flexDirection: "column", gap: "2" })}>
						<div className={css({ h: "4", w: "32", borderRadius: "md", bg: "gray.200" })} />
						<div className={css({ h: "3", w: "48", borderRadius: "md", bg: "gray.200" })} />
					</div>
				</div>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Types — 性質 (Config) と 状態 (State) の分離
// ---------------------------------------------------------------------------
// FriendItem を Identity (不変な識別情報) と State (変動する情報) に分離。
// これにより:
// - コンポーネントが必要最小限の型のみ受け取れる (Props の最小化)
// - 不変データに readonly を付与し、誤った変更を防げる
// - 将来 @line-crm/contracts の Zod スキーマに置き換える際の移行が容易
//
// TODO: z.infer<> from @line-crm/contracts に置き換え

interface TagItem {
	readonly id: string;
	readonly name: string;
	readonly color: string;
}

/**
 * 性質 (Config): 友だちの識別情報 — 登録時に決定され、以降変わらない。
 * LINE プラットフォーム側で付与される ID と、システム側の登録日時。
 */
interface FriendIdentity {
	readonly id: string;
	readonly lineUserId: string;
	readonly createdAt: string;
}

/**
 * 状態 (State): 友だちの変動する情報。
 * ユーザー操作やLINE側の変更で随時更新される属性群。
 * - displayName, pictureUrl: LINE プロフィール変更で変動
 * - isFollowing: フォロー/ブロック操作で変動
 * - score: スコアリングルール適用で変動
 * - tags: タグ付け/解除操作で変動
 */
interface FriendState {
	displayName: string | null;
	pictureUrl: string | null;
	isFollowing: boolean;
	score: number;
	tags: readonly TagItem[];
}

/**
 * 合成型: API レスポンスの友だちアイテム。
 * Identity (不変) と State (変動) を結合した完全な型。
 */
interface FriendItem extends FriendIdentity, FriendState {}

interface FriendListResponse {
	items: FriendItem[];
	total: number;
	page: number;
	hasNextPage: boolean;
}
