import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBody, validateJson, validateParam, validateQuery } from "../validate.js";

// Schema for testing
const NameSchema = z.object({
	name: z.string().min(1, "Name is required"),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
		.optional(),
});

const PageSchema = z.object({
	page: z.coerce.number().int().positive(),
	limit: z.coerce.number().int().positive().default(20),
});

const UuidLikeSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// validateJson
// ---------------------------------------------------------------------------
describe("validateJson", () => {
	it("正常なJSON_c.req.valid('json')でパース結果を取得できる", async () => {
		const app = new Hono();
		app.post("/test", validateJson(NameSchema), (c) => {
			const body = c.req.valid("json");
			return c.json({ body });
		});

		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "VIP", color: "#FF0000" }),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.body).toEqual({ name: "VIP", color: "#FF0000" });
	});

	it("不正なJSON文字列_400エラーを返す", async () => {
		const app = new Hono();
		app.post("/test", validateJson(NameSchema), (c) => c.json({ ok: true }));

		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{bad json",
		});

		expect(res.status).toBe(400);
	});

	it("スキーマ不一致_バリデーション詳細付き400エラーを返す", async () => {
		const app = new Hono();
		app.post("/test", validateJson(NameSchema), (c) => c.json({ ok: true }));

		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}), // name missing
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe("Validation failed");
		expect(data.details).toHaveProperty("name");
	});

	it("不正なcolor形式_バリデーションエラーのdetailsにcolorが含まれる", async () => {
		const app = new Hono();
		app.post("/test", validateJson(NameSchema), (c) => c.json({ ok: true }));

		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "tag", color: "red" }),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.success).toBe(false);
		expect(data.details).toHaveProperty("color");
	});
});

// ---------------------------------------------------------------------------
// validateQuery
// ---------------------------------------------------------------------------
describe("validateQuery", () => {
	it("正常なクエリパラメータ_c.req.valid('query')で取得できる", async () => {
		const app = new Hono();
		app.get("/test", validateQuery(PageSchema), (c) => {
			const query = c.req.valid("query");
			return c.json({ query });
		});

		const res = await app.request("/test?page=2&limit=10");

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.query).toEqual({ page: 2, limit: 10 });
	});

	it("不正なpage値_400エラーとdetailsを返す", async () => {
		const app = new Hono();
		app.get("/test", validateQuery(PageSchema), (c) => c.json({ ok: true }));

		const res = await app.request("/test?page=abc");

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe("Invalid query parameters");
	});
});

// ---------------------------------------------------------------------------
// validateParam
// ---------------------------------------------------------------------------
describe("validateParam", () => {
	it("正常なUUIDパラメータ_c.req.valid('param')で取得できる", async () => {
		const app = new Hono();
		const testId = crypto.randomUUID();
		app.get("/test/:id", validateParam(z.object({ id: UuidLikeSchema })), (c) => {
			const { id } = c.req.valid("param");
			return c.json({ id });
		});

		const res = await app.request(`/test/${testId}`);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.id).toBe(testId);
	});

	it("不正なIDフォーマット_400エラーを返す", async () => {
		const app = new Hono();
		app.get("/test/:id", validateParam(z.object({ id: UuidLikeSchema })), (c) => c.json({ ok: true }));

		const res = await app.request("/test/not-a-uuid");

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe("Invalid path parameter");
	});

	it("複数のパスパラメータを同時にバリデーションできる", async () => {
		const app = new Hono();
		const parentId = crypto.randomUUID();
		const childId = crypto.randomUUID();
		app.delete(
			"/parents/:parentId/children/:childId",
			validateParam(z.object({ parentId: UuidLikeSchema, childId: UuidLikeSchema })),
			(c) => {
				const params = c.req.valid("param");
				return c.json(params);
			},
		);

		const res = await app.request(`/parents/${parentId}/children/${childId}`, {
			method: "DELETE",
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.parentId).toBe(parentId);
		expect(data.childId).toBe(childId);
	});
});

// ---------------------------------------------------------------------------
// validateBody (legacy alias)
// ---------------------------------------------------------------------------
describe("validateBody (legacy alias)", () => {
	it("validateJsonと同一の関数である", () => {
		expect(validateBody).toBe(validateJson);
	});
});
