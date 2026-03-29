// =============================================================================
// Media Routes — Upload, serve, list, and delete media assets via R2
// =============================================================================
// POST   /api/media/upload       — Upload an image file (authenticated)
// GET    /api/media/serve/:key+  — Serve an image (public, long-cached)
// GET    /api/media              — List media assets by purpose (authenticated)
// DELETE /api/media/:key+        — Delete a media asset (authenticated)
// =============================================================================

import { HTTP_ERRORS, MEDIA_CONFIG, MIDDLEWARE_LIMITS } from "@line-crm/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timeout } from "hono/timeout";
import type { Env } from "../index.js";
import { createMediaStorageService } from "../services/media-storage.service.js";

const media = new Hono<Env>();

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Check whether a string is a valid media purpose */
function isValidPurpose(value: string): value is (typeof MEDIA_CONFIG.purposes)[number] {
	return (MEDIA_CONFIG.purposes as readonly string[]).includes(value);
}

/** Check whether a MIME type is in the allowed list */
function isAllowedContentType(value: string): boolean {
	return (MEDIA_CONFIG.allowedContentTypes as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// POST /api/media/upload — Upload an image file
// ---------------------------------------------------------------------------
// Expects multipart/form-data with:
//   - file: File        (required) — the image binary
//   - purpose: string   (required) — one of MEDIA_CONFIG.purposes
//   - lineAccountId: string (optional) — associated LINE account
// ---------------------------------------------------------------------------

media.post(
	"/api/media/upload",
	bodyLimit({ maxSize: MIDDLEWARE_LIMITS.mediaUploadMaxBytes }),
	timeout(MIDDLEWARE_LIMITS.mediaUploadTimeoutMs),
	async (c) => {
		const formData = await c.req.formData();
		const file = formData.get("file");
		const purpose = formData.get("purpose");
		const lineAccountId = formData.get("lineAccountId");

		// --- Field presence validation ---
		if (!(file instanceof File)) {
			return c.json({ success: false, error: 'Field "file" is required and must be a File' }, 400);
		}

		if (typeof purpose !== "string" || !isValidPurpose(purpose)) {
			return c.json(
				{
					success: false,
					error: `Field "purpose" must be one of: ${MEDIA_CONFIG.purposes.join(", ")}`,
				},
				400,
			);
		}

		// --- Content type validation ---
		if (!isAllowedContentType(file.type)) {
			return c.json(
				{
					success: false,
					error: `Invalid file type "${file.type}". Allowed: ${MEDIA_CONFIG.allowedContentTypes.join(", ")}`,
				},
				400,
			);
		}

		// --- File size validation ---
		if (file.size > MEDIA_CONFIG.maxFileSizeBytes) {
			const maxMb = Math.floor(MEDIA_CONFIG.maxFileSizeBytes / (1024 * 1024));
			return c.json({ success: false, error: `File too large. Maximum size is ${maxMb} MB` }, 400);
		}

		// --- Upload to R2 ---
		const storage = createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL);
		const result = await storage.upload(await file.arrayBuffer(), file.name, file.type, {
			uploadedBy: c.get("staff").id,
			purpose,
			lineAccountId: typeof lineAccountId === "string" ? lineAccountId : undefined,
		});

		return c.json({ success: true, data: result }, 201);
	},
);

// ---------------------------------------------------------------------------
// GET /api/media/serve/* — Serve an image (public, cached)
// ---------------------------------------------------------------------------
// The key is the remainder of the path after /api/media/serve/.
// This route is in PUBLIC_ROUTES.patterns so it bypasses auth middleware,
// allowing cached CDN / browser access without credentials.
// ---------------------------------------------------------------------------

media.get("/api/media/serve/*", async (c) => {
	const key = c.req.path.replace("/api/media/serve/", "");

	if (!key || key.length === 0) {
		return c.json({ success: false, error: HTTP_ERRORS.notFound }, 404);
	}

	const storage = createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL);
	const object = await storage.get(key);

	if (!object) {
		return c.json({ success: false, error: HTTP_ERRORS.notFound }, 404);
	}

	const headers = new Headers({
		"Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
		"Cache-Control": MEDIA_CONFIG.cacheControlServe,
		ETag: object.etag,
	});

	// Support conditional requests (If-None-Match)
	const ifNoneMatch = c.req.header("If-None-Match");
	if (ifNoneMatch && ifNoneMatch === object.etag) {
		return new Response(null, { status: 304, headers });
	}

	return new Response(object.body, { status: 200, headers });
});

// ---------------------------------------------------------------------------
// GET /api/media — List media assets (authenticated)
// ---------------------------------------------------------------------------
// Query params:
//   - purpose: string (required) — filter by purpose prefix
//   - limit: number   (optional, default 50)
//   - cursor: string  (optional) — pagination cursor
// ---------------------------------------------------------------------------

media.get("/api/media", async (c) => {
	const purpose = c.req.query("purpose");
	const limitParam = c.req.query("limit");
	const cursor = c.req.query("cursor");

	if (!(purpose && isValidPurpose(purpose))) {
		return c.json(
			{
				success: false,
				error: `Query "purpose" must be one of: ${MEDIA_CONFIG.purposes.join(", ")}`,
			},
			400,
		);
	}

	const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : 50;

	const storage = createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL);
	const result = await storage.list(purpose, limit, cursor || undefined);

	return c.json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// DELETE /api/media/* — Delete a media asset (authenticated)
// ---------------------------------------------------------------------------
// The key is the remainder of the path after /api/media/.
// Only staff with existing auth can delete assets.
// ---------------------------------------------------------------------------

media.delete("/api/media/*", async (c) => {
	const key = c.req.path.replace("/api/media/", "");

	if (!key || key.length === 0) {
		return c.json({ success: false, error: HTTP_ERRORS.notFound }, 404);
	}

	const storage = createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL);

	// Verify the object exists before deleting
	const existing = await storage.get(key);
	if (!existing) {
		return c.json({ success: false, error: HTTP_ERRORS.notFound }, 404);
	}

	await storage.delete(key);

	return c.json({ success: true, data: null });
});

export { media };
