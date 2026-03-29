// =============================================================================
// Rich Menu Routes — LINE rich menu CRUD, image upload (R2 + LINE API), linking
// =============================================================================
// GET    /api/rich-menus              — List all rich menus from LINE API
// POST   /api/rich-menus              — Create a rich menu via LINE API
// DELETE /api/rich-menus/:id          — Delete a rich menu
// POST   /api/rich-menus/:id/default  — Set as default for all users
// POST   /api/rich-menus/:id/image    — Upload image (R2 backup + LINE API)
// POST   /api/friends/:friendId/rich-menu   — Link rich menu to a friend
// DELETE /api/friends/:friendId/rich-menu   — Unlink rich menu from a friend
// =============================================================================

import { MEDIA_CONFIG } from "@line-crm/contracts";
import { getFriendById } from "@line-crm/db";
import { LineClient } from "@line-crm/line-sdk";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { createMediaStorageService } from "../services/media-storage.service.js";

const DATA_URI_PREFIX_PATTERN = /^data:image\/\w+;base64,/;

const richMenus = new Hono<Env>();

// ---------------------------------------------------------------------------
// GET /api/rich-menus — list all rich menus from LINE API
// ---------------------------------------------------------------------------

richMenus.get("/api/rich-menus", async (c) => {
	try {
		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		const result = await lineClient.getRichMenuList();
		return c.json({ success: true, data: result.richmenus ?? [] });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("GET /api/rich-menus error:", message);
		return c.json({ success: false, error: `Failed to fetch rich menus: ${message}` }, 500);
	}
});

// ---------------------------------------------------------------------------
// POST /api/rich-menus — create a rich menu via LINE API
// ---------------------------------------------------------------------------

richMenus.post("/api/rich-menus", async (c) => {
	try {
		const body = await c.req.json();
		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		const result = await lineClient.createRichMenu(body);
		return c.json({ success: true, data: result }, 201);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("POST /api/rich-menus error:", message);
		return c.json({ success: false, error: `Failed to create rich menu: ${message}` }, 500);
	}
});

// ---------------------------------------------------------------------------
// DELETE /api/rich-menus/:id — delete a rich menu
// ---------------------------------------------------------------------------

richMenus.delete("/api/rich-menus/:id", async (c) => {
	try {
		const richMenuId = c.req.param("id");
		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await lineClient.deleteRichMenu(richMenuId);
		return c.json({ success: true, data: null });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("DELETE /api/rich-menus/:id error:", message);
		return c.json({ success: false, error: `Failed to delete rich menu: ${message}` }, 500);
	}
});

// ---------------------------------------------------------------------------
// POST /api/rich-menus/:id/default — set rich menu as default for all users
// ---------------------------------------------------------------------------

richMenus.post("/api/rich-menus/:id/default", async (c) => {
	try {
		const richMenuId = c.req.param("id");
		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await lineClient.setDefaultRichMenu(richMenuId);
		return c.json({ success: true, data: null });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("POST /api/rich-menus/:id/default error:", message);
		return c.json({ success: false, error: `Failed to set default rich menu: ${message}` }, 500);
	}
});

// ---------------------------------------------------------------------------
// POST /api/rich-menus/:id/image — Upload rich menu image
// ---------------------------------------------------------------------------
// Accepts base64 (JSON body) or raw binary (image/* Content-Type).
// The image is first backed up to R2 under the "rich_menu" purpose, then
// uploaded to the LINE Messaging API for the specified rich menu ID.
// ---------------------------------------------------------------------------

richMenus.post("/api/rich-menus/:id/image", async (c) => {
	try {
		const richMenuId = c.req.param("id");
		const contentType = c.req.header("content-type") ?? "";

		let imageData: ArrayBuffer;
		let imageContentType: "image/png" | "image/jpeg" = "image/png";
		let originalFilename = `richmenu-${richMenuId}`;

		if (contentType.includes("application/json")) {
			// Accept base64 encoded image in JSON body
			const body = await c.req.json<{ image: string; contentType?: string; filename?: string }>();
			if (!body.image) {
				return c.json({ success: false, error: "image (base64) is required" }, 400);
			}
			// Strip data URI prefix if present
			const base64 = body.image.replace(DATA_URI_PREFIX_PATTERN, "");
			const binaryString = atob(base64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			imageData = bytes.buffer;
			if (body.contentType === "image/jpeg") imageContentType = "image/jpeg";
			if (body.filename) originalFilename = body.filename;
		} else if (contentType.includes("image/")) {
			// Accept raw binary upload
			imageData = await c.req.arrayBuffer();
			imageContentType = contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" : "image/png";
		} else {
			return c.json(
				{
					success: false,
					error: "Content-Type must be application/json (with base64) or image/png or image/jpeg",
				},
				400,
			);
		}

		// Validate file size against configured maximum
		if (imageData.byteLength > MEDIA_CONFIG.maxFileSizeBytes) {
			const maxMb = Math.floor(MEDIA_CONFIG.maxFileSizeBytes / (1024 * 1024));
			return c.json({ success: false, error: `Image too large. Maximum size is ${maxMb} MB` }, 400);
		}

		// Step 1: Back up to R2 for management / disaster recovery
		const storage = createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL);
		const extension = imageContentType === "image/jpeg" ? ".jpg" : ".png";
		const r2Result = await storage.upload(imageData, `${originalFilename}${extension}`, imageContentType, {
			uploadedBy: c.get("staff").id,
			purpose: "rich_menu",
		});

		// Step 2: Upload to LINE Messaging API
		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await lineClient.uploadRichMenuImage(richMenuId, imageData, imageContentType);

		return c.json({
			success: true,
			data: {
				richMenuId,
				r2Key: r2Result.key,
				r2Url: r2Result.url,
				contentType: imageContentType,
				size: imageData.byteLength,
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("POST /api/rich-menus/:id/image error:", message);
		return c.json({ success: false, error: `Failed to upload rich menu image: ${message}` }, 500);
	}
});

// ---------------------------------------------------------------------------
// POST /api/friends/:friendId/rich-menu — link rich menu to a specific friend
// ---------------------------------------------------------------------------

richMenus.post("/api/friends/:friendId/rich-menu", async (c) => {
	try {
		const friendId = c.req.param("friendId");
		const body = await c.req.json<{ richMenuId: string }>();

		if (!body.richMenuId) {
			return c.json({ success: false, error: "richMenuId is required" }, 400);
		}

		const db = c.env.DB;
		const friend = await getFriendById(db, friendId);
		if (!friend) {
			return c.json({ success: false, error: "Friend not found" }, 404);
		}

		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await lineClient.linkRichMenuToUser(friend.line_user_id, body.richMenuId);

		return c.json({ success: true, data: null });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("POST /api/friends/:friendId/rich-menu error:", message);
		return c.json({ success: false, error: `Failed to link rich menu to friend: ${message}` }, 500);
	}
});

// ---------------------------------------------------------------------------
// DELETE /api/friends/:friendId/rich-menu — unlink rich menu from a specific friend
// ---------------------------------------------------------------------------

richMenus.delete("/api/friends/:friendId/rich-menu", async (c) => {
	try {
		const friendId = c.req.param("friendId");
		const db = c.env.DB;

		const friend = await getFriendById(db, friendId);
		if (!friend) {
			return c.json({ success: false, error: "Friend not found" }, 404);
		}

		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		await lineClient.unlinkRichMenuFromUser(friend.line_user_id);

		return c.json({ success: true, data: null });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("DELETE /api/friends/:friendId/rich-menu error:", message);
		return c.json({ success: false, error: `Failed to unlink rich menu from friend: ${message}` }, 500);
	}
});

export { richMenus };
