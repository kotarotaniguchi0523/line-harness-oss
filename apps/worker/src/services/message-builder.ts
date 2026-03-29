/**
 * Message Builder — 型安全なディスパッチテーブルによるメッセージ構築
 *
 * MessageType ごとに純粋関数 (I/O なし) でメッセージオブジェクトを組み立てる。
 * JSON パース失敗時は neverthrow の fromThrowable で安全にフォールバックする。
 *
 * broadcast.ts, step-delivery.ts, segment-send.ts, reminder-delivery.ts など
 * 複数箇所に散在していた buildMessage ロジックを一元化。
 */

import type { MessageType } from "@line-crm/contracts";
import type { FlexContainer, Message } from "@line-crm/line-sdk";
import { fromThrowable } from "neverthrow";

// ---------------------------------------------------------------------------
// Pure helpers (no I/O)
// ---------------------------------------------------------------------------

/** Safely parse JSON string, returning null on failure */
const safeJsonParse = fromThrowable(
	(s: string) => JSON.parse(s) as unknown,
	(e) => (e instanceof Error ? e : new Error(String(e))),
);

/** Recursively find the first text element in a Flex Message for altText */
function extractFlexAltText(obj: unknown, depth = 0): string | null {
	if (depth > 10 || !obj || typeof obj !== "object") return null;
	const node = obj as Record<string, unknown>;
	if (node.type === "text" && typeof node.text === "string") {
		return node.text.slice(0, 100);
	}
	if (Array.isArray(node.contents)) {
		for (const child of node.contents) {
			const found = extractFlexAltText(child, depth + 1);
			if (found) return found;
		}
	}
	for (const key of ["header", "body", "footer"]) {
		if (node[key]) {
			const found = extractFlexAltText(node[key], depth + 1);
			if (found) return found;
		}
	}
	return null;
}

/** Remove empty text nodes from Flex JSON (caused by conditional blocks) */
function cleanEmptyNodes(obj: unknown): void {
	if (!obj || typeof obj !== "object") return;
	const node = obj as Record<string, unknown>;
	for (const key of ["header", "body", "footer"]) {
		if (node[key]) cleanEmptyNodes(node[key]);
	}
	if (Array.isArray(node.contents)) {
		node.contents = (node.contents as unknown[]).filter((c) => {
			if (c && typeof c === "object" && (c as Record<string, unknown>).type === "text") {
				const text = (c as Record<string, unknown>).text;
				return typeof text === "string" && text.trim().length > 0;
			}
			return true;
		});
		for (const c of node.contents as unknown[]) cleanEmptyNodes(c);
	}
}

// ---------------------------------------------------------------------------
// Fallback (used when JSON parse fails or type is unknown)
// ---------------------------------------------------------------------------

function textFallback(content: string): Message {
	return { type: "text", text: content };
}

// ---------------------------------------------------------------------------
// Dispatch table: Record<MessageType, builder>
// ---------------------------------------------------------------------------

type MessageBuilder = (content: string) => Message;

const builders: Record<MessageType, MessageBuilder> = {
	text: (content) => ({ type: "text", text: content }),

	image: (content) => {
		const parsed = safeJsonParse(content);
		if (parsed.isErr()) return textFallback(content);
		const data = parsed.value as { originalContentUrl: string; previewImageUrl: string };
		return {
			type: "image",
			originalContentUrl: data.originalContentUrl,
			previewImageUrl: data.previewImageUrl,
		};
	},

	flex: (content) => {
		const parsed = safeJsonParse(content);
		if (parsed.isErr()) return textFallback(content);
		const contents = parsed.value as FlexContainer;
		cleanEmptyNodes(contents);
		const altText = extractFlexAltText(contents) ?? "お知らせ";
		return { type: "flex", altText, contents };
	},

	carousel: (content) => {
		const parsed = safeJsonParse(content);
		if (parsed.isErr()) return textFallback(content);
		const contents = parsed.value as FlexContainer;
		cleanEmptyNodes(contents);
		const altText = extractFlexAltText(contents) ?? "お知らせ";
		return { type: "flex", altText, contents };
	},

	video: (content) => {
		const parsed = safeJsonParse(content);
		if (parsed.isErr()) return textFallback(content);
		const data = parsed.value as { originalContentUrl: string; previewImageUrl: string };
		return {
			type: "video",
			originalContentUrl: data.originalContentUrl,
			previewImageUrl: data.previewImageUrl,
		};
	},
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a LINE Message object from a type discriminant and raw content string.
 *
 * Pure function — no I/O, no side effects.
 * Unknown message types fall back to plain text.
 */
export function buildMessage(type: string, content: string): Message {
	const builder = builders[type as MessageType];
	return builder ? builder(content) : textFallback(content);
}
