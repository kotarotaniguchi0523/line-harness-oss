import { CreateBroadcastSchema, SegmentConditionSchema, UpdateBroadcastSchema, UuidSchema } from "@line-crm/contracts";
import { createBroadcastRepository } from "@line-crm/db";
import type { BroadcastId, LineAccountId } from "@line-crm/domain";
import { LineClient } from "@line-crm/line-sdk";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";
import { processBroadcastSend } from "../services/broadcast.js";
import { processSegmentSend } from "../services/segment-send.js";

const broadcasts = new Hono<Env>();

// GET /api/broadcasts - list all
broadcasts.get("/api/broadcasts", async (c) => {
	try {
		const db = c.get("db");
		const broadcastRepo = createBroadcastRepository(db);
		const lineAccountId = c.req.query("lineAccountId");
		const items = await broadcastRepo.list(lineAccountId as LineAccountId | undefined);
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/broadcasts error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/broadcasts/:id - get single
broadcasts.get("/api/broadcasts/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const broadcastRepo = createBroadcastRepository(db);
		const broadcast = await broadcastRepo.findById(id as BroadcastId);

		if (!broadcast) {
			return c.json({ success: false, error: "Broadcast not found" }, 404);
		}

		return c.json({ success: true, data: broadcast });
	} catch (err) {
		console.error("GET /api/broadcasts/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/broadcasts - create
broadcasts.post("/api/broadcasts", validateJson(CreateBroadcastSchema), async (c) => {
	try {
		const body = c.req.valid("json");
		const db = c.get("db");
		const broadcastRepo = createBroadcastRepository(db);

		const id = await broadcastRepo.create({
			title: body.title,
			messageType: body.messageType,
			messageContent: body.messageContent,
			targetType: body.targetType,
			targetTagId: body.targetTagId ?? null,
			scheduledAt: body.scheduledAt ?? null,
		});

		// Save line_account_id if provided
		if (body.lineAccountId) {
			await c.env.DB.prepare("UPDATE broadcasts SET line_account_id = ? WHERE id = ?")
				.bind(body.lineAccountId, id)
				.run();
		}

		const broadcast = await broadcastRepo.findById(id as BroadcastId);
		return c.json({ success: true, data: broadcast }, 201);
	} catch (err) {
		console.error("POST /api/broadcasts error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/broadcasts/:id - update draft
broadcasts.put(
	"/api/broadcasts/:id",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(UpdateBroadcastSchema),
	async (c) => {
		try {
			const { id } = c.req.valid("param");
			const db = c.get("db");
			const broadcastRepo = createBroadcastRepository(db);
			const existing = await broadcastRepo.findById(id as BroadcastId);

			if (!existing) {
				return c.json({ success: false, error: "Broadcast not found" }, 404);
			}

			if (existing.status !== "draft" && existing.status !== "scheduled") {
				return c.json({ success: false, error: "Only draft or scheduled broadcasts can be updated" }, 400);
			}

			const body = c.req.valid("json");

			// Keep status in sync with scheduledAt changes
			let statusUpdate: string | undefined;
			if (body.scheduledAt !== undefined) {
				statusUpdate = body.scheduledAt ? "scheduled" : "draft";
			}

			await broadcastRepo.update(id as BroadcastId, {
				title: body.title,
				messageType: body.messageType,
				messageContent: body.messageContent,
				targetType: body.targetType,
				targetTagId: body.targetTagId,
				scheduledAt: body.scheduledAt,
				...(statusUpdate !== undefined ? { status: statusUpdate } : {}),
			});

			const updated = await broadcastRepo.findById(id as BroadcastId);
			return c.json({ success: true, data: updated });
		} catch (err) {
			console.error("PUT /api/broadcasts/:id error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

// DELETE /api/broadcasts/:id - delete
broadcasts.delete("/api/broadcasts/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const broadcastRepo = createBroadcastRepository(db);
		await broadcastRepo.softDelete(id as BroadcastId);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/broadcasts/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/broadcasts/:id/send - send now
broadcasts.post("/api/broadcasts/:id/send", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const db = c.get("db");
		const broadcastRepo = createBroadcastRepository(db);
		const existing = await broadcastRepo.findById(id as BroadcastId);

		if (!existing) {
			return c.json({ success: false, error: "Broadcast not found" }, 404);
		}

		if (existing.status === "sending" || existing.status === "sent") {
			return c.json({ success: false, error: "Broadcast is already sent or sending" }, 400);
		}

		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await processBroadcastSend(c.env.DB, lineClient, id, c.env.WORKER_URL);

		const result = await broadcastRepo.findById(id as BroadcastId);
		return c.json({ success: true, data: result });
	} catch (err) {
		console.error("POST /api/broadcasts/:id/send error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/broadcasts/:id/send-segment - send to a filtered segment
broadcasts.post(
	"/api/broadcasts/:id/send-segment",
	validateParam(z.object({ id: UuidSchema })),
	validateJson(z.object({ conditions: SegmentConditionSchema })),
	async (c) => {
		try {
			const { id } = c.req.valid("param");
			const db = c.get("db");
			const broadcastRepo = createBroadcastRepository(db);
			const existing = await broadcastRepo.findById(id as BroadcastId);

			if (!existing) {
				return c.json({ success: false, error: "Broadcast not found" }, 404);
			}

			if (existing.status === "sending" || existing.status === "sent") {
				return c.json({ success: false, error: "Broadcast is already sent or sending" }, 400);
			}

			const { conditions } = c.req.valid("json");

			const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
			await processSegmentSend(c.env.DB, lineClient, id, conditions);

			const result = await broadcastRepo.findById(id as BroadcastId);
			return c.json({ success: true, data: result });
		} catch (err) {
			console.error("POST /api/broadcasts/:id/send-segment error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { broadcasts };
