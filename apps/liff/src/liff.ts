// =============================================================================
// LIFF SDK Bridge — typed wrapper around the global `liff` object
// =============================================================================
// LIFF SDK is loaded via CDN <script> tag in index.html.
// This module provides typed access to the global liff object.

declare const liff: {
	init(config: { liffId: string }): Promise<void>;
	isLoggedIn(): boolean;
	login(opts?: { redirectUri?: string }): void;
	getProfile(): Promise<LiffProfile>;
	getIDToken(): string | null;
	getFriendship(): Promise<{ friendFlag: boolean }>;
	isInClient(): boolean;
	closeWindow(): void;
};

export interface LiffProfile {
	userId: string;
	displayName: string;
	pictureUrl?: string;
	statusMessage?: string;
}

const LIFF_ID = new URLSearchParams(window.location.search).get("liffId") || import.meta.env?.VITE_LIFF_ID || "";

let initialized = false;

export async function initLiff(): Promise<void> {
	if (initialized) return;
	await liff.init({ liffId: LIFF_ID });
	initialized = true;

	if (!liff.isLoggedIn()) {
		liff.login({ redirectUri: window.location.href });
		throw new Error("Redirecting to LINE login...");
	}
}

export function getProfile(): Promise<LiffProfile> {
	return liff.getProfile();
}

export function getIDToken(): string | null {
	return liff.getIDToken();
}

export function getFriendship(): Promise<{ friendFlag: boolean }> {
	return liff.getFriendship();
}

export function isInClient(): boolean {
	return liff.isInClient();
}

export function closeLiffWindow(): void {
	if (liff.isInClient()) liff.closeWindow();
}
