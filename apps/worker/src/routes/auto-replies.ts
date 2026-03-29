// =============================================================================
// Auto Reply API Routes — CRUD with multi-message support
// =============================================================================

import { CreateAutoReplySchema, DOMAIN_LIMITS, UpdateAutoReplySchema } from "@line-crm/contracts";
import { createAutoReplyRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { validateJson } from "../middleware/validate.js";

const autoRepliesRoute = new Hono<Env>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AutoReply {
	id: string;
	keyword: string;
	matchType: string;
	responseType: string;
	responseContent: string;
	isActive: boolean;
	priority: number;
	lineAccountId: string | null;
	createdAt: string;
	updatedAt: string;
}

interface AutoReplyMessage {
	id: string;
	autoReplyId: string;
	messageOrder: number;
	messageType: string;
	messageContent: string;
	createdAt: string;
	updatedAt: string;
}

interface AutoReplyWithMessages extends AutoReply {
	messages: AutoReplyMessage[];
}

function sortRepliesForResponse(replies: AutoReplyWithMessages[]) {
	return [...replies].sort((a, b) => {
		if (a.priority !== b.priority) return b.priority - a.priority;
		return a.createdAt.localeCompare(b.createdAt);
	});
}

// ---------------------------------------------------------------------------
// GET /api/auto-replies — list all auto replies (with their messages)
// ---------------------------------------------------------------------------
autoRepliesRoute.get("/api/auto-replies", async (c) => {
	try {
		const lineAccountId = c.req.query("lineAccountId");
		const db = c.get("db");
		const repo = createAutoReplyRepository(db);

		const replies = await repo.list(lineAccountId);
		const repliesWithMessages = await Promise.all(
			replies.map(async (reply) => (await repo.getWithMessages(reply.id)) ?? { ...reply, messages: [] }),
		);

		return c.json({
			success: true,
			data: sortRepliesForResponse(repliesWithMessages),
		});
	} catch (err) {
		console.error("GET /api/auto-replies error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ---------------------------------------------------------------------------
// GET /api/auto-replies/:id — get single auto reply with messages
// ---------------------------------------------------------------------------
autoRepliesRoute.get("/api/auto-replies/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const repo = createAutoReplyRepository(db);
		const row = await repo.getWithMessages(id);

		if (!row) return c.json({ success: false, error: "Auto reply not found" }, 404);

		return c.json({
			success: true,
			data: row,
		});
	} catch (err) {
		console.error("GET /api/auto-replies/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ---------------------------------------------------------------------------
// POST /api/auto-replies — create with multi-message support
// ---------------------------------------------------------------------------
autoRepliesRoute.post("/api/auto-replies", validateJson(CreateAutoReplySchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const db = c.get("db");
		const repo = createAutoReplyRepository(db);
		const id = await repo.create({
			keyword: body.keyword,
			matchType: body.matchType,
			isActive: body.isActive,
			priority: body.priority,
			lineAccountId: body.lineAccountId ?? null,
			messages: body.messages.slice(0, DOMAIN_LIMITS.maxAutoReplyMessages),
		});
		const created = await repo.getWithMessages(id);

		return c.json(
			{
				success: true,
				data: created ?? { id },
			},
			201,
		);
	} catch (err) {
		console.error("POST /api/auto-replies error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ---------------------------------------------------------------------------
// PUT /api/auto-replies/:id — update rule + optionally replace messages
// ---------------------------------------------------------------------------
autoRepliesRoute.put("/api/auto-replies/:id", validateJson(UpdateAutoReplySchema), async (c) => {
	try {
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const db = c.get("db");
		const repo = createAutoReplyRepository(db);

		// Check existence
		const existing = await repo.getWithMessages(id);
		if (!existing) return c.json({ success: false, error: "Auto reply not found" }, 404);

		await repo.update(id, {
			keyword: body.keyword,
			matchType: body.matchType,
			isActive: body.isActive,
			priority: body.priority,
			lineAccountId: body.lineAccountId,
		});

		// Replace messages if provided
		if (body.messages) {
			const cappedMessages = body.messages.slice(0, DOMAIN_LIMITS.maxAutoReplyMessages);

			for (const message of existing.messages) {
				await repo.removeMessage(message.id);
			}

			for (const message of cappedMessages) {
				await repo.addMessage(id, {
					messageType: message.messageType,
					messageContent: message.messageContent,
				});
			}
		}

		// Re-fetch
		const updated = await repo.getWithMessages(id);

		return c.json({
			success: true,
			data: updated ?? null,
		});
	} catch (err) {
		console.error("PUT /api/auto-replies/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ---------------------------------------------------------------------------
// DELETE /api/auto-replies/:id — cascade delete reply + messages
// ---------------------------------------------------------------------------
autoRepliesRoute.delete("/api/auto-replies/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const repo = createAutoReplyRepository(db);
		await repo.delete(id);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/auto-replies/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { autoRepliesRoute };
