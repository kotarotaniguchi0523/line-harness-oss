// =============================================================================
// API Client for LIFF app
// =============================================================================

const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8787";

export async function apiCall<T = unknown>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json() as Promise<T>;
}

export function linkUser(idToken: string | null, displayName: string, ref: string | null) {
	return apiCall("/api/liff/link", {
		method: "POST",
		body: JSON.stringify({ idToken, displayName, ref }),
	});
}

export function trackClick(code: string) {
	return apiCall("/api/affiliates/click", {
		method: "POST",
		body: JSON.stringify({ code, url: window.location.href }),
	}).catch(() => {
		/* best-effort */
	});
}
