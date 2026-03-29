// =============================================================================
// Cap'n Web RPC Client + Legacy REST Client
// =============================================================================
// Authentication uses httpOnly cookies managed by better-auth.
// No API keys in localStorage. Cookies are sent automatically via credentials: "include".

import { newHttpBatchRpcSession } from "capnweb";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

/**
 * Create an RPC session with cookie-based auth.
 * Uses HTTP batch mode for efficient pipeline processing.
 * The session cookie is sent automatically by the browser.
 */
export function createRpcSession() {
	return newHttpBatchRpcSession(`${API_URL}/rpc`);
}

/**
 * REST API client for endpoints not yet migrated to RPC.
 * Uses cookie-based auth (credentials: "include").
 */
export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		...options,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
		throw new Error(body.error || `API error: ${res.status}`);
	}
	return res.json() as Promise<T>;
}
