import { CreateBroadcastSchema, SegmentConditionSchema, UpdateBroadcastSchema, UuidSchema } from "@line-crm/contracts";
import type { BroadcastMessageType, Broadcast as DbBroadcast } from "@line-crm/db";
import {
	createBroadcast,
	createBroadcastRepository,
	deleteBroadcast,
	getBroadcastById,
	updateBroadcast,
} from "@line-crm/db";
import type { LineAccountId } from "@line-crm/domain";
import { LineClient } from "@line-crm/line-sdk";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index.js";
import { validateJson, validateParam } from "../middleware/validate.js";
import { processBroadcastSend } from "../services/broadcast.js";
import { processSegmentSend } from "../services/segment-send.js";

const broadcasts = new Hono<Env>();

function serializeBroadcast(row: DbBroadcast) {
	return {
		id: row.id,
		title: row.title,
		messageType: row.message_type,
		messageContent: row.message_content,
		targetType: row.target_type,
		targetTagId: row.target_tag_id,
		status: row.status,
		scheduledAt: row.scheduled_at,
		sentAt: row.sent_at,
		totalCount: row.total_count,
		successCount: row.success_count,
		createdAt: row.created_at,
	};
}

// GET /api/broadcasts - list all
broadcasts.get("/api/broadcasts", async (c) => {
	try {
		const db = c.get("db");
		const broadcastRepo = createBroadcastRepository(db);
		const lineAccountId = c.req.query("lineAccountId");
		const items = await broadcastRepo.list(lineAccountId as LineAccountId | undefined);
		return c.json({
			success: true,
			data: items.map((row) => ({
				id: row.id,
				title: row.title,
				messageType: row.messageType,
				messageContent: row.messageContent,
				targetType: row.targetType,
				targetTagId: row.targetTagId,
				status: row.status,
				scheduledAt: row.scheduledAt,
				sentAt: row.sentAt,
				totalCount: row.totalCount,
				successCount: row.successCount,
				createdAt: row.createdAt,
			})),
		});
	} catch (err) {
		console.error("GET /api/broadcasts error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/broadcasts/:id - get single
broadcasts.get("/api/broadcasts/:id", validateParam(z.object({ id: UuidSchema })), async (c) => {
	try {
		const { id } = c.req.valid("param");
		const broadcast = await getBroadcastById(c.env.DB, id);

		if (!broadcast) {
			return c.json({ success: false, error: "Broadcast not found" }, 404);
		}

		return c.json({ success: true, data: serializeBroadcast(broadcast) });
	} catch (err) {
		console.error("GET /api/broadcasts/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/broadcasts - create
broadcasts.post("/api/broadcasts", validateJson(CreateBroadcastSchema), async (c) => {
	try {
		const body = c.req.valid("json");

		const broadcast = await createBroadcast(c.env.DB, {
			title: body.title,
			messageType: body.messageType as BroadcastMessageType,
			messageContent: body.messageContent,
			targetType: body.targetType,
			targetTagId: body.targetTagId ?? null,
			scheduledAt: body.scheduledAt ?? null,
		});

		// TODO: Migrate to Drizzle repository once createBroadcastRepository.create() accepts lineAccountId in the initial insert
		// Save line_account_id if provided
		if (body.lineAccountId) {
			await c.env.DB.prepare("UPDATE broadcasts SET line_account_id = ? WHERE id = ?")
				.bind(body.lineAccountId, broadcast.id)
				.run();
		}

		return c.json({ success: true, data: serializeBroadcast(broadcast) }, 201);
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
			const existing = await getBroadcastById(c.env.DB, id);

			if (!existing) {
				return c.json({ success: false, error: "Broadcast not found" }, 404);
			}

			if (existing.status !== "draft" && existing.status !== "scheduled") {
				return c.json({ success: false, error: "Only draft or scheduled broadcasts can be updated" }, 400);
			}

			const body = c.req.valid("json");

			// Keep status in sync with scheduledAt changes
			let statusUpdate: "draft" | "scheduled" | undefined;
			if (body.scheduledAt !== undefined) {
				statusUpdate = body.scheduledAt ? "scheduled" : "draft";
			}

			const updated = await updateBroadcast(c.env.DB, id, {
				title: body.title,
				message_type: body.messageType as BroadcastMessageType | undefined,
				message_content: body.messageContent,
				target_type: body.targetType,
				target_tag_id: body.targetTagId,
				scheduled_at: body.scheduledAt,
				...(statusUpdate !== undefined ? { status: statusUpdate } : {}),
			});

			return c.json({ success: true, data: updated ? serializeBroadcast(updated) : null });
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
		await deleteBroadcast(c.env.DB, id);
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
		const existing = await getBroadcastById(c.env.DB, id);

		if (!existing) {
			return c.json({ success: false, error: "Broadcast not found" }, 404);
		}

		if (existing.status === "sending" || existing.status === "sent") {
			return c.json({ success: false, error: "Broadcast is already sent or sending" }, 400);
		}

		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await processBroadcastSend(c.env.DB, lineClient, id, c.env.WORKER_URL);

		const result = await getBroadcastById(c.env.DB, id);
		return c.json({ success: true, data: result ? serializeBroadcast(result) : null });
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
			const existing = await getBroadcastById(c.env.DB, id);

			if (!existing) {
				return c.json({ success: false, error: "Broadcast not found" }, 404);
			}

			if (existing.status === "sending" || existing.status === "sent") {
				return c.json({ success: false, error: "Broadcast is already sent or sending" }, 400);
			}

			const { conditions } = c.req.valid("json");

			const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
			await processSegmentSend(c.env.DB, lineClient, id, conditions);

			const result = await getBroadcastById(c.env.DB, id);
			return c.json({ success: true, data: result ? serializeBroadcast(result) : null });
		} catch (err) {
			console.error("POST /api/broadcasts/:id/send-segment error:", err);
			return c.json({ success: false, error: "Internal server error" }, 500);
		}
	},
);

export { broadcasts };
