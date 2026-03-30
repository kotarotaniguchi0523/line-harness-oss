import { createReminderRepository } from "@line-crm/db";
import type { FriendId, ReminderId } from "@line-crm/domain";
import { Hono } from "hono";
import type { Env } from "../index.js";

const reminders = new Hono<Env>();

// ========== リマインダCRUD ==========

reminders.get("/api/reminders", async (c) => {
	try {
		const lineAccountId = c.req.query("lineAccountId");
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		let items: Awaited<ReturnType<typeof reminderRepo.list>>;
		if (lineAccountId) {
			// TODO: Migrate to createReminderRepository once list() supports lineAccountId filtering
			const result = await c.env.DB.prepare(
				"SELECT * FROM reminders WHERE line_account_id = ? ORDER BY created_at DESC",
			)
				.bind(lineAccountId)
				.all();
			items = result.results as unknown as Awaited<ReturnType<typeof reminderRepo.list>>;
		} else {
			items = await reminderRepo.list();
		}
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/reminders error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.get("/api/reminders/:id", async (c) => {
	try {
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		const reminder = await reminderRepo.findById(c.req.param("id") as ReminderId);
		if (!reminder) return c.json({ success: false, error: "Reminder not found" }, 404);
		return c.json({ success: true, data: reminder });
	} catch (err) {
		console.error("GET /api/reminders/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.post("/api/reminders", async (c) => {
	try {
		const body = await c.req.json<{ name: string; description?: string; lineAccountId?: string | null }>();
		if (!body.name) return c.json({ success: false, error: "name is required" }, 400);
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		const id = await reminderRepo.create(body);
		// Save line_account_id if provided
		if (body.lineAccountId) {
			await c.env.DB.prepare("UPDATE reminders SET line_account_id = ? WHERE id = ?")
				.bind(body.lineAccountId, id)
				.run();
		}
		const item = await reminderRepo.findById(id as ReminderId);
		return c.json({ success: true, data: item }, 201);
	} catch (err) {
		console.error("POST /api/reminders error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.put("/api/reminders/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		await reminderRepo.update(id as ReminderId, body);
		const updated = await reminderRepo.findById(id as ReminderId);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/reminders/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.delete("/api/reminders/:id", async (c) => {
	try {
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		await reminderRepo.delete(c.req.param("id") as ReminderId);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/reminders/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== リマインダステップ ==========

reminders.post("/api/reminders/:id/steps", async (c) => {
	try {
		const reminderId = c.req.param("id");
		const body = await c.req.json<{ offsetMinutes: number; messageType: string; messageContent: string }>();
		if (body.offsetMinutes === undefined || !body.messageType || !body.messageContent) {
			return c.json({ success: false, error: "offsetMinutes, messageType, messageContent are required" }, 400);
		}
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		const id = await reminderRepo.addStep({ reminderId: reminderId as ReminderId, ...body });
		return c.json({ success: true, data: { id } }, 201);
	} catch (err) {
		console.error("POST /api/reminders/:id/steps error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.delete("/api/reminders/:reminderId/steps/:stepId", async (c) => {
	try {
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		await reminderRepo.removeStep(c.req.param("stepId"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/reminders/:reminderId/steps/:stepId error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== 友だちリマインダ登録 ==========

reminders.post("/api/reminders/:id/enroll/:friendId", async (c) => {
	try {
		const reminderId = c.req.param("id");
		const friendId = c.req.param("friendId");
		const body = await c.req.json<{ targetDate: string }>();
		if (!body.targetDate) return c.json({ success: false, error: "targetDate is required" }, 400);
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		const id = await reminderRepo.enrollFriend({
			friendId: friendId as FriendId,
			reminderId: reminderId as ReminderId,
			targetDate: body.targetDate,
		});
		return c.json({ success: true, data: { id } }, 201);
	} catch (err) {
		console.error("POST /api/reminders/:id/enroll/:friendId error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.get("/api/friends/:friendId/reminders", async (c) => {
	try {
		const friendId = c.req.param("friendId");
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		const items = await reminderRepo.getFriendReminders(friendId as FriendId);
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/friends/:friendId/reminders error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

reminders.delete("/api/friend-reminders/:id", async (c) => {
	try {
		const db = c.get("db");
		const reminderRepo = createReminderRepository(db);
		await reminderRepo.cancelFriendReminder(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/friend-reminders/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { reminders };
