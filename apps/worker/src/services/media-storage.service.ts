// =============================================================================
// Media Storage Service — R2-backed image and asset management
// =============================================================================
// Provides upload, retrieval, deletion, and listing for media assets stored
// in Cloudflare R2.  All keys are content-addressed (UUID prefix) and
// organised by purpose (rich_menu, message_image, liff_asset, form_attachment).
//
// Usage:
//   const storage = createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL);
//   const result  = await storage.upload(buffer, 'menu.png', 'image/png', metadata);
// =============================================================================

import { MEDIA_CONFIG, type MediaPurpose } from "@line-crm/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned after a successful upload */
export interface UploadResult {
	/** R2 object key (purpose/uuid-filename) */
	key: string;
	/** Public URL for serving the asset */
	url: string;
	/** MIME content type */
	contentType: string;
	/** Size of the uploaded asset in bytes */
	size: number;
}

/** Metadata attached to every uploaded asset */
export interface MediaMetadata {
	/** Staff ID who performed the upload */
	uploadedBy: string;
	/** Categorisation of the media asset */
	purpose: MediaPurpose;
	/** Optional LINE account association */
	lineAccountId?: string;
}

/** Summary of a single listed media object */
export interface MediaListItem {
	/** R2 object key */
	key: string;
	/** Size in bytes */
	size: number;
	/** Last modified ISO timestamp */
	lastModified: string;
}

/** Paginated list result */
export interface MediaListResult {
	items: MediaListItem[];
	truncated: boolean;
	cursor: string | undefined;
}

// ---------------------------------------------------------------------------
// Filename sanitisation
// ---------------------------------------------------------------------------

/**
 * Strip dangerous characters from a user-supplied filename.
 * Keeps only alphanumerics, dots, hyphens, and underscores, then truncates
 * to the configured maximum length.
 */
function sanitizeFilename(name: string): string {
	const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
	return cleaned.slice(0, MEDIA_CONFIG.maxFilenameLength);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an R2-backed media storage service.
 *
 * The service is stateless — instantiate per-request using the R2 binding and
 * the worker's public base URL.
 *
 * @param bucket    - Cloudflare R2 bucket binding (`MEDIA_BUCKET`)
 * @param workerUrl - Public base URL of the worker (e.g. `https://line-crm-worker.…`)
 */
export function createMediaStorageService(bucket: R2Bucket, workerUrl: string) {
	// ----------------------------------------------------------
	// Internal helpers
	// ----------------------------------------------------------

	/** Build the content-addressed R2 key for a new upload */
	function buildKey(purpose: MediaPurpose, filename: string): string {
		const sanitised = sanitizeFilename(filename);
		const uuid = crypto.randomUUID();
		return `${purpose}/${uuid}-${sanitised}`;
	}

	/** Build the public serving URL for a given key */
	function buildServeUrl(key: string): string {
		return `${workerUrl}/api/media/serve/${key}`;
	}

	// ----------------------------------------------------------
	// Public API
	// ----------------------------------------------------------

	return {
		/**
		 * Upload a media asset to R2.
		 *
		 * Stores the file under `{purpose}/{uuid}-{sanitised-filename}` with
		 * custom metadata for auditing (uploader, purpose, account, timestamp).
		 *
		 * @param file        - Raw bytes (ArrayBuffer) or readable stream
		 * @param filename    - Original filename (will be sanitised)
		 * @param contentType - MIME type (must be in MEDIA_CONFIG.allowedContentTypes)
		 * @param metadata    - Upload context (who, why, which account)
		 * @returns Upload result with key, public URL, content type, and size
		 */
		async upload(
			file: ArrayBuffer | ReadableStream,
			filename: string,
			contentType: string,
			metadata: MediaMetadata,
		): Promise<UploadResult> {
			const key = buildKey(metadata.purpose, filename);

			await bucket.put(key, file, {
				httpMetadata: { contentType },
				customMetadata: {
					uploadedBy: metadata.uploadedBy,
					purpose: metadata.purpose,
					lineAccountId: metadata.lineAccountId ?? "",
					uploadedAt: new Date().toISOString(),
				},
			});

			const size = file instanceof ArrayBuffer ? file.byteLength : 0;

			return {
				key,
				url: buildServeUrl(key),
				contentType,
				size,
			};
		},

		/**
		 * Retrieve a media asset from R2 by key.
		 *
		 * Returns the full R2 object body (including headers and stream) or null
		 * if the key does not exist.
		 */
		async get(key: string): Promise<R2ObjectBody | null> {
			return bucket.get(key);
		},

		/**
		 * Delete a media asset from R2 by key.
		 *
		 * This is a no-op if the key does not exist (R2 delete is idempotent).
		 */
		async delete(key: string): Promise<void> {
			await bucket.delete(key);
		},

		/**
		 * List media assets filtered by purpose prefix.
		 *
		 * Returns a paginated list of object summaries.  Pass the returned
		 * `cursor` value to subsequent calls to paginate through large sets.
		 *
		 * @param purpose - Media purpose prefix to filter by
		 * @param limit   - Maximum number of items to return (default 50)
		 * @param cursor  - Continuation cursor from a previous list call
		 */
		async list(purpose: MediaPurpose, limit = 50, cursor?: string): Promise<MediaListResult> {
			const result = await bucket.list({
				prefix: `${purpose}/`,
				limit,
				cursor,
			});

			const items: MediaListItem[] = result.objects.map((obj) => ({
				key: obj.key,
				size: obj.size,
				lastModified: obj.uploaded.toISOString(),
			}));

			return {
				items,
				truncated: result.truncated,
				cursor: result.truncated ? result.cursor : undefined,
			};
		},

		/**
		 * Build the public serving URL for a given R2 key.
		 * Useful when you already have the key but need the full URL.
		 */
		getServeUrl(key: string): string {
			return buildServeUrl(key);
		},
	};
}
