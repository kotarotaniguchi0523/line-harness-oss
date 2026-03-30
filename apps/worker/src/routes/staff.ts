import { createStaffRepository } from "@line-crm/db";
import type { StaffId } from "@line-crm/domain";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { requireRole } from "../middleware/role-guard.js";

const staff = new Hono<Env>();

function maskApiKey(key: string): string {
	return `lh_****${key.slice(-4)}`;
}

function serializeStaff(row: Awaited<ReturnType<ReturnType<typeof createStaffRepository>["findById"]>>, masked = true) {
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		apiKey: masked ? maskApiKey(row.apiKey) : row.apiKey,
		isActive: row.isActive,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// GET /api/staff/me — any authenticated user (MUST be before /:id)
staff.get("/api/staff/me", async (c) => {
	try {
		const currentStaff = c.get("staff");

		// env-owner: return minimal info
		if (currentStaff.id === "env-owner") {
			return c.json({
				success: true,
				data: {
					id: "env-owner",
					name: "Owner",
					role: "owner",
					email: null,
				},
			});
		}

		const db = c.get("db");
		const staffRepo = createStaffRepository(db);
		const member = await staffRepo.findById(currentStaff.id as StaffId);
		if (!member) {
			return c.json({ success: false, error: "Staff member not found" }, 404);
		}

		return c.json({
			success: true,
			data: {
				id: member.id,
				name: member.name,
				role: member.role,
				email: member.email,
			},
		});
	} catch (err) {
		console.error("GET /api/staff/me error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/staff — owner only. List all staff with masked API keys.
staff.get("/api/staff", requireRole("owner"), async (c) => {
	try {
		const db = c.get("db");
		const staffRepo = createStaffRepository(db);
		const members = await staffRepo.list();
		return c.json({ success: true, data: members.map((m) => serializeStaff(m, true)) });
	} catch (err) {
		console.error("GET /api/staff error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/staff/:id — owner only. Get staff detail with masked key.
staff.get("/api/staff/:id", requireRole("owner"), async (c) => {
	try {
		const id = c.req.param("id") as string;
		const db = c.get("db");
		const staffRepo = createStaffRepository(db);
		const member = await staffRepo.findById(id as StaffId);
		if (!member) {
			return c.json({ success: false, error: "Staff member not found" }, 404);
		}
		return c.json({ success: true, data: serializeStaff(member, true) });
	} catch (err) {
		console.error("GET /api/staff/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/staff — owner only. Create staff. Returns full API key (one-time visible).
staff.post("/api/staff", requireRole("owner"), async (c) => {
	try {
		const body = await c.req.json<{ name: string; email?: string; role: string }>();

		if (!body.name) {
			return c.json({ success: false, error: "name is required" }, 400);
		}

		const validRoles = ["owner", "admin", "staff"] as const;
		if (!(body.role && validRoles.includes(body.role as (typeof validRoles)[number]))) {
			return c.json({ success: false, error: "role must be owner, admin, or staff" }, 400);
		}

		const db = c.get("db");
		const staffRepo = createStaffRepository(db);
		const id = await staffRepo.create({
			name: body.name,
			email: body.email ?? null,
			role: body.role as "owner" | "admin" | "staff",
		});
		const member = await staffRepo.findById(id as StaffId);

		// Return full (unmasked) API key one-time
		return c.json({ success: true, data: serializeStaff(member, false) }, 201);
	} catch (err) {
		console.error("POST /api/staff error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PATCH /api/staff/:id — owner only. Update staff.
staff.patch("/api/staff/:id", requireRole("owner"), async (c) => {
	try {
		const id = c.req.param("id") as string;
		const body = await c.req.json<{
			name?: string;
			email?: string | null;
			role?: string;
			isActive?: boolean;
		}>();

		const validRoles = ["owner", "admin", "staff"] as const;
		if (body.role !== undefined && !validRoles.includes(body.role as (typeof validRoles)[number])) {
			return c.json({ success: false, error: "role must be owner, admin, or staff" }, 400);
		}

		const db = c.get("db");
		const staffRepo = createStaffRepository(db);

		// Prevent removing the last active owner
		const target = await staffRepo.findById(id as StaffId);
		if (!target) {
			return c.json({ success: false, error: "Staff member not found" }, 404);
		}
		if (target.role === "owner" && target.isActive) {
			const willLoseOwner = (body.role !== undefined && body.role !== "owner") || body.isActive === false;
			if (willLoseOwner) {
				const ownerCount = await staffRepo.countByRole("owner");
				if (ownerCount <= 1) {
					return c.json({ success: false, error: "オーナーは最低1人必要です" }, 400);
				}
			}
		}

		await staffRepo.update(id as StaffId, {
			name: body.name,
			email: body.email,
			role: body.role as "owner" | "admin" | "staff" | undefined,
			isActive: body.isActive,
		});

		const updated = await staffRepo.findById(id as StaffId);
		if (!updated) {
			return c.json({ success: false, error: "Staff member not found" }, 404);
		}

		return c.json({ success: true, data: serializeStaff(updated, true) });
	} catch (err) {
		console.error("PATCH /api/staff/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/staff/:id — owner only. Cannot delete self. Must keep at least 1 owner.
staff.delete("/api/staff/:id", requireRole("owner"), async (c) => {
	try {
		const id = c.req.param("id") as string;
		const currentStaff = c.get("staff");

		if (id === currentStaff.id) {
			return c.json({ success: false, error: "自分自身は削除できません" }, 400);
		}

		const db = c.get("db");
		const staffRepo = createStaffRepository(db);
		const target = await staffRepo.findById(id as StaffId);
		if (!target) {
			return c.json({ success: false, error: "Staff member not found" }, 404);
		}

		if (target.role === "owner" && target.isActive) {
			const ownerCount = await staffRepo.countByRole("owner");
			if (ownerCount <= 1) {
				return c.json({ success: false, error: "オーナーは最低1人必要です" }, 400);
			}
		}

		await staffRepo.delete(id as StaffId);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/staff/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/staff/:id/regenerate-key — owner only. Return new API key.
staff.post("/api/staff/:id/regenerate-key", requireRole("owner"), async (c) => {
	try {
		const id = c.req.param("id") as string;
		const db = c.get("db");
		const staffRepo = createStaffRepository(db);
		const exists = await staffRepo.findById(id as StaffId);
		if (!exists) {
			return c.json({ success: false, error: "Staff member not found" }, 404);
		}
		const newKey = await staffRepo.regenerateApiKey(id as StaffId);
		return c.json({ success: true, data: { apiKey: newKey } });
	} catch (err) {
		console.error("POST /api/staff/:id/regenerate-key error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { staff };
