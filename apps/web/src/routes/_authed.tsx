import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { getUser } from "@/functions/get-user";
import { css } from "../../styled-system/css";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await getUser();
		if (!session?.user) {
			throw redirect({ to: "/login" });
		}
		return { session };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	return (
		<div className={css({ display: "flex", h: "full" })}>
			<Sidebar />
			<main className={css({ flex: "1", overflow: "auto", p: { base: "4", sm: "6", lg: "8" } })}>
				<Suspense fallback={<PageSkeleton />}>
					<Outlet />
				</Suspense>
			</main>
		</div>
	);
}

function PageSkeleton() {
	return (
		<div className={css({ animation: "pulse", display: "flex", flexDirection: "column", gap: "4" })}>
			<div className={css({ h: "8", w: "48", borderRadius: "md", bg: "gray.200" })} />
			<div className={css({ h: "64", borderRadius: "md", bg: "gray.100" })} />
		</div>
	);
}

const navItems = [
	{ to: "/", label: "ダッシュボード" },
	{ to: "/friends", label: "友だち管理" },
	{ to: "/scenarios", label: "シナリオ配信" },
	{ to: "/broadcasts", label: "一斉配信" },
	{ to: "/tags", label: "タグ管理" },
	{ to: "/chats", label: "チャット" },
	{ to: "/templates", label: "テンプレート" },
	{ to: "/auto-replies", label: "自動応答" },
	{ to: "/automations", label: "オートメーション" },
	{ to: "/scoring", label: "スコアリング" },
	{ to: "/reminders", label: "リマインダー" },
	{ to: "/conversions", label: "CV計測" },
	{ to: "/affiliates", label: "アフィリエイト" },
	{ to: "/webhooks", label: "Webhook" },
	{ to: "/notifications", label: "通知" },
	{ to: "/health", label: "BAN検知" },
	{ to: "/staff", label: "スタッフ管理" },
	{ to: "/accounts", label: "アカウント" },
] as const;

function Sidebar() {
	return (
		<aside
			className={css({
				display: { base: "none", lg: "block" },
				w: "56",
				flexShrink: "0",
				borderRightWidth: "1px",
				borderColor: "gray.200",
				bg: "white",
			})}
		>
			<div className={css({ p: "4" })}>
				<h1 className={css({ fontSize: "lg", fontWeight: "bold", color: "gray.900" })}>LINE Harness</h1>
			</div>
			<nav className={css({ display: "flex", flexDirection: "column", gap: "0.5", px: "2" })}>
				{navItems.map((item) => (
					<Link
						key={item.to}
						to={`/_authed${item.to === "/" ? "" : item.to}`}
						className={css({
							display: "block",
							borderRadius: "md",
							px: "3",
							py: "2",
							fontSize: "sm",
							color: "gray.700",
							_hover: { bg: "gray.100", color: "gray.900" },
						})}
						activeProps={{ className: css({ bg: "gray.100", color: "gray.900", fontWeight: "medium" }) }}
					>
						{item.label}
					</Link>
				))}
			</nav>
		</aside>
	);
}
