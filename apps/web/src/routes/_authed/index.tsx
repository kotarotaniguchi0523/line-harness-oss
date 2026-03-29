import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { css } from "../../../styled-system/css";
import { queryOptionsConfig } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/")({
	// Prefetch all dashboard stats in route loader for instant rendering
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData({
				...queryOptionsConfig.friends.count(),
				queryFn: () => fetchApi<{ success: true; data: { count: number } }>("/api/friends/count"),
			}),
			queryClient.ensureQueryData({
				...queryOptionsConfig.scenarios.list(),
				queryFn: () => fetchApi<{ success: true; data: Array<{ isActive: boolean }> }>("/api/scenarios"),
			}),
			queryClient.ensureQueryData({
				...queryOptionsConfig.broadcasts.list(),
				queryFn: () => fetchApi<{ success: true; data: unknown[] }>("/api/broadcasts"),
			}),
		]);
	},
	component: DashboardPage,
});

// ---------------------------------------------------------------------------
// Route Component (< 30 lines — orchestrates layout only)
// ---------------------------------------------------------------------------
function DashboardPage() {
	return (
		<div>
			<h1 className={css({ mb: "6", fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>ダッシュボード</h1>
			<p className={css({ mb: "6", fontSize: "sm", color: "gray.500" })}>LINE公式アカウント CRM 管理画面</p>

			<div className={css({ display: "grid", gridTemplateColumns: { base: "1", sm: "2", xl: "3" }, gap: "4" })}>
				<Suspense fallback={<StatCardSkeleton />}>
					<FriendCountCard />
				</Suspense>
				<Suspense fallback={<StatCardSkeleton />}>
					<ActiveScenarioCard />
				</Suspense>
				<Suspense fallback={<StatCardSkeleton />}>
					<BroadcastCountCard />
				</Suspense>
			</div>

			<QuickLinks />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Container Components (data fetching via useSuspenseQuery)
// ---------------------------------------------------------------------------
function FriendCountCard() {
	const { data } = useSuspenseQuery({
		...queryOptionsConfig.friends.count(),
		queryFn: () => fetchApi<{ success: true; data: { count: number } }>("/api/friends/count"),
	});
	return <StatCard title="友だち数" value={data.data.count} accent="#06C755" href="/friends" />;
}

function ActiveScenarioCard() {
	const { data } = useSuspenseQuery({
		...queryOptionsConfig.scenarios.list(),
		queryFn: () => fetchApi<{ success: true; data: Array<{ isActive: boolean }> }>("/api/scenarios"),
	});
	const activeCount = data.data.filter((s) => s.isActive).length;
	return <StatCard title="アクティブシナリオ" value={activeCount} accent="#3B82F6" href="/scenarios" />;
}

function BroadcastCountCard() {
	const { data } = useSuspenseQuery({
		...queryOptionsConfig.broadcasts.list(),
		queryFn: () => fetchApi<{ success: true; data: unknown[] }>("/api/broadcasts"),
	});
	return <StatCard title="配信数" value={data.data.length} accent="#8B5CF6" href="/broadcasts" />;
}

// ---------------------------------------------------------------------------
// Presentation Components (pure, no data fetching)
// ---------------------------------------------------------------------------
function StatCard({ title, value, accent, href }: { title: string; value: number; accent: string; href: string }) {
	return (
		<Link
			to={`/_authed${href}`}
			className={css({
				borderRadius: "lg",
				borderWidth: "1px",
				borderColor: "gray.200",
				bg: "white",
				p: "6",
				shadow: "sm",
				_hover: { shadow: "md" },
				transition: "shadows",
			})}
		>
			<div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
				<div className={css({ h: "10", w: "10", borderRadius: "lg" })} style={{ backgroundColor: `${accent}20` }} />
				<div>
					<p className={css({ fontSize: "sm", color: "gray.500" })}>{title}</p>
					<p className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>
						{value.toLocaleString("ja-JP")}
					</p>
				</div>
			</div>
		</Link>
	);
}

function StatCardSkeleton() {
	return (
		<div
			className={css({
				borderRadius: "lg",
				borderWidth: "1px",
				borderColor: "gray.200",
				bg: "white",
				p: "6",
				shadow: "sm",
			})}
		>
			<div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
				<div className={css({ h: "10", w: "10", animation: "pulse", borderRadius: "lg", bg: "gray.200" })} />
				<div>
					<div className={css({ h: "4", w: "16", animation: "pulse", borderRadius: "md", bg: "gray.200" })} />
					<div className={css({ mt: "2", h: "7", w: "20", animation: "pulse", borderRadius: "md", bg: "gray.200" })} />
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Quick Links (static, no data dependency)
// ---------------------------------------------------------------------------
const quickLinks = [
	{ label: "友だち管理", to: "/_authed/friends" },
	{ label: "シナリオ配信", to: "/_authed/scenarios" },
	{ label: "一斉配信", to: "/_authed/broadcasts" },
	{ label: "チャット", to: "/_authed/chats" },
	{ label: "BAN検知", to: "/_authed/health" },
] as const;

function QuickLinks() {
	return (
		<div
			className={css({
				mt: "8",
				borderRadius: "lg",
				borderWidth: "1px",
				borderColor: "gray.200",
				bg: "white",
				p: "6",
				shadow: "sm",
			})}
		>
			<h2 className={css({ mb: "4", fontSize: "lg", fontWeight: "semibold", color: "gray.900" })}>クイックリンク</h2>
			<div className={css({ display: "grid", gridTemplateColumns: { base: "1", sm: "2" }, gap: "3" })}>
				{quickLinks.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						className={css({
							display: "flex",
							alignItems: "center",
							gap: "3",
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.200",
							p: "3",
							_hover: { borderColor: "green.300", bg: "green.50" },
							transition: "colors",
						})}
					>
						<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.700" })}>{link.label}</span>
					</Link>
				))}
			</div>
		</div>
	);
}
