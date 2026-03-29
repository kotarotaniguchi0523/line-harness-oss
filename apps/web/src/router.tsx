import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";

import Loader from "./components/loader";
import { DEFAULT_QUERY_OPTIONS } from "./lib/query-config";

import "./index.css";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
	const queryClient = new QueryClient({ defaultOptions: DEFAULT_QUERY_OPTIONS });
	return routerWithQueryClient(
		createTanStackRouter({
			routeTree,
			scrollRestoration: true,
			defaultPreloadStaleTime: 0,
			context: { queryClient },
			defaultPendingComponent: () => <Loader />,
			defaultNotFoundComponent: () => <div>Not Found</div>,
		}),
		queryClient,
	);
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
