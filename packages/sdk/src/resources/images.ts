import type { HttpClient } from "../http.js";
import type { ApiResponse } from "../types.js";

export interface ImageUploadInput {
	data: string;
	mimeType?: string;
	filename?: string;
}

export interface ImageUploadResult {
	id: string;
	key: string;
	url: string;
	mimeType: string;
	size: number;
}

export class ImagesResource {
	constructor(private readonly http: HttpClient) {}

	async upload(input: ImageUploadInput): Promise<ImageUploadResult> {
		const res = await this.http.post<ApiResponse<ImageUploadResult>>("/api/images", {
			data: input.data,
			mimeType: input.mimeType,
			filename: input.filename,
		});
		return res.data;
	}

	async delete(key: string): Promise<void> {
		await this.http.delete(`/api/images/${encodeURIComponent(key)}`);
	}
}
