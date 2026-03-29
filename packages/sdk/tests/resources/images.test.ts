// NOTE: The ImagesResource implementation is pending (not yet in packages/sdk/src/resources/).
// These tests define the expected interface based on the specification.
// Update the import once the implementation file exists.

import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../../src/http.js";

function mockHttp(overrides: Partial<HttpClient> = {}): HttpClient {
	return {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		...overrides,
	} as unknown as HttpClient;
}

// ── Inline stub until the real resource is created ──────────────────────────
class ImagesResource {
	constructor(private readonly http: HttpClient) {}

	async upload(data: {
		base64: string;
		fileName: string;
		mimeType?: string;
	}): Promise<{ imageId: string; url: string }> {
		const res = await (this.http.post as any)("/api/images", {
			base64: data.base64,
			fileName: data.fileName,
			mimeType: data.mimeType ?? "image/png",
		});
		return res.data;
	}

	async delete(imageId: string): Promise<void> {
		await (this.http.delete as any)(`/api/images/${imageId}`);
	}
}
// ── End stub ────────────────────────────────────────────────────────────────

describe("ImagesResource", () => {
	describe("upload()", () => {
		it("sends POST /api/images with base64 data", async () => {
			const imageData = {
				imageId: "img-123",
				url: "https://cdn.example.com/img-123.png",
			};
			const http = mockHttp({
				post: vi.fn().mockResolvedValue({ success: true, data: imageData }),
			});
			const resource = new ImagesResource(http);

			const result = await resource.upload({
				base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				fileName: "test.png",
			});

			expect(http.post).toHaveBeenCalledWith("/api/images", {
				base64: expect.any(String),
				fileName: "test.png",
				mimeType: "image/png",
			});
			expect(result).toEqual(imageData);
		});

		it("sends POST with custom mimeType", async () => {
			const imageData = {
				imageId: "img-456",
				url: "https://cdn.example.com/img-456.jpg",
			};
			const http = mockHttp({
				post: vi.fn().mockResolvedValue({ success: true, data: imageData }),
			});
			const resource = new ImagesResource(http);

			await resource.upload({
				base64: "/9j/4AAQSkZJRg==",
				fileName: "photo.jpg",
				mimeType: "image/jpeg",
			});

			expect(http.post).toHaveBeenCalledWith("/api/images", {
				base64: "/9j/4AAQSkZJRg==",
				fileName: "photo.jpg",
				mimeType: "image/jpeg",
			});
		});

		it("throws on failed upload", async () => {
			const http = mockHttp({
				post: vi.fn().mockRejectedValue(new Error("Upload failed: file too large")),
			});
			const resource = new ImagesResource(http);

			await expect(
				resource.upload({
					base64: "too-large-data",
					fileName: "huge.png",
				}),
			).rejects.toThrow("Upload failed: file too large");
		});
	});

	describe("delete()", () => {
		it("sends DELETE /api/images/:id", async () => {
			const http = mockHttp({
				delete: vi.fn().mockResolvedValue({ success: true, data: null }),
			});
			const resource = new ImagesResource(http);

			await resource.delete("img-123");

			expect(http.delete).toHaveBeenCalledWith("/api/images/img-123");
		});

		it("throws on delete failure", async () => {
			const http = mockHttp({
				delete: vi.fn().mockRejectedValue(new Error("Not found")),
			});
			const resource = new ImagesResource(http);

			await expect(resource.delete("nonexistent")).rejects.toThrow("Not found");
		});
	});
});
