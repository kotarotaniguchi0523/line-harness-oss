import { Toaster } from "@line-crm/ui/components/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { css } from "../../styled-system/css";
import Header from "../components/header";
import appCss from "../index.css?url";
import { DEFAULT_QUERY_OPTIONS } from "../lib/query-config";

// Shared QueryClient with domain-aware cache defaults (from query-config.ts)
export const queryClient = new QueryClient({
	defaultOptions: DEFAULT_QUERY_OPTIONS,
});

export interface RouterAppContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "LINE Harness" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootDocument,
	errorComponent: GlobalError,
});

function RootDocument() {
	return (
		<html lang="ja">
			<head>
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<div className={css({ display: "grid", h: "svh", gridTemplateRows: "auto 1fr" })}>
						<Header />
						<Outlet />
					</div>
					<Toaster richColors />
				</QueryClientProvider>
				<TanStackRouterDevtools position="bottom-left" />
				<Scripts />
			</body>
		</html>
	);
}

function GlobalError({ error }: { error: Error }) {
	return (
		<html lang="ja">
			<head>
				<HeadContent />
			</head>
			<body>
				<div
					className={css({ display: "flex", minH: "screen", alignItems: "center", justifyContent: "center", p: "8" })}
				>
					<div
						className={css({
							maxW: "md",
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "red.200",
							bg: "red.50",
							p: "6",
						})}
					>
						<h1 className={css({ mb: "2", fontSize: "lg", fontWeight: "bold", color: "red.800" })}>
							エラーが発生しました
						</h1>
						<p className={css({ fontSize: "sm", color: "red.700" })}>{error.message}</p>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className={css({
								mt: "4",
								borderRadius: "lg",
								bg: "red.600",
								px: "4",
								py: "2",
								fontSize: "sm",
								color: "white",
								_hover: { bg: "red.700" },
							})}
						>
							再読み込み
						</button>
					</div>
				</div>
				<Scripts />
			</body>
		</html>
	);
}
