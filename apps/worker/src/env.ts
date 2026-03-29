// =============================================================================
// t3-env: Type-safe environment variables for Cloudflare Workers
// =============================================================================

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const serverSchema = {
	LINE_CHANNEL_SECRET: z.string().min(1),
	LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
	API_KEY: z.string().min(1),
	WORKER_URL: z.string().url().optional(),
	LIFF_URL: z.string().url().optional(),
	LINE_LOGIN_CHANNEL_ID: z.string().optional(),
	LINE_LOGIN_CHANNEL_SECRET: z.string().optional(),
};

export const env = createEnv({
	server: serverSchema,
	runtimeEnv: process.env,
});

/**
 * Create env from Cloudflare Worker Bindings.
 * Use this instead of `env` in Hono handlers.
 */
export function createWorkerEnv(bindings: Record<string, string | undefined>) {
	return createEnv({
		server: serverSchema,
		runtimeEnv: bindings,
	});
}
