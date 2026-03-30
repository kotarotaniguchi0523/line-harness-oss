import { createUserRepository } from "@line-crm/db";
import { Hono } from "hono";
import type { Env } from "../index.js";

const users = new Hono<Env>();

// GET /api/users - list all
users.get("/api/users", async (c) => {
	try {
		const db = c.get("db");
		const userRepo = createUserRepository(db);
		const items = await userRepo.list();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/users error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/users/:id - get single
users.get("/api/users/:id", async (c) => {
	try {
		const db = c.get("db");
		const userRepo = createUserRepository(db);
		const user = await userRepo.findById(c.req.param("id"));
		if (!user) {
			return c.json({ success: false, error: "User not found" }, 404);
		}
		return c.json({ success: true, data: user });
	} catch (err) {
		console.error("GET /api/users/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/users - create
users.post("/api/users", async (c) => {
	try {
		const body = await c.req.json<{
			email?: string | null;
			phone?: string | null;
			externalId?: string | null;
			displayName?: string | null;
		}>();

		const db = c.get("db");
		const userRepo = createUserRepository(db);
		const id = await userRepo.create(body);
		const user = await userRepo.findById(id);
		return c.json({ success: true, data: user }, 201);
	} catch (err) {
		console.error("POST /api/users error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/users/:id - update
users.put("/api/users/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json<{
			email?: string | null;
			phone?: string | null;
			externalId?: string | null;
			displayName?: string | null;
		}>();

		const db = c.get("db");
		const userRepo = createUserRepository(db);
		await userRepo.update(id, {
			email: body.email,
			phone: body.phone,
			externalId: body.externalId,
			displayName: body.displayName,
		});

		const updated = await userRepo.findById(id);
		if (!updated) {
			return c.json({ success: false, error: "User not found" }, 404);
		}
		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/users/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/users/:id - delete
users.delete("/api/users/:id", async (c) => {
	try {
		const db = c.get("db");
		const userRepo = createUserRepository(db);
		await userRepo.delete(c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/users/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/users/:id/link - link friend to user UUID
users.post("/api/users/:id/link", async (c) => {
	try {
		const userId = c.req.param("id");
		const body = await c.req.json<{ friendId: string }>();

		if (!body.friendId) {
			return c.json({ success: false, error: "friendId is required" }, 400);
		}

		const db = c.get("db");
		const userRepo = createUserRepository(db);
		await userRepo.linkFriend(body.friendId, userId);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("POST /api/users/:id/link error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/users/:id/accounts - get all linked friends/accounts
users.get("/api/users/:id/accounts", async (c) => {
	try {
		const userId = c.req.param("id");
		const db = c.get("db");
		const userRepo = createUserRepository(db);
		const friends = await userRepo.getUserFriends(userId);
		return c.json({ success: true, data: friends });
	} catch (err) {
		console.error("GET /api/users/:id/accounts error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/users/match - find user by email or phone
users.post("/api/users/match", async (c) => {
	try {
		const body = await c.req.json<{ email?: string; phone?: string }>();
		const db = c.get("db");
		const userRepo = createUserRepository(db);
		let user = null;

		if (body.email) {
			user = await userRepo.findByEmail(body.email);
		}
		if (!user && body.phone) {
			// Phone lookup not directly available in repo; fall back to raw query
			const result = await c.env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(body.phone).first();
			user = result ?? null;
		}

		if (!user) {
			return c.json({ success: false, error: "User not found" }, 404);
		}
		return c.json({ success: true, data: user });
	} catch (err) {
		console.error("POST /api/users/match error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { users };
