import {
	type CreateFormRequest,
	CreateFormSchema,
	type SubmitFormRequest,
	type UpdateFormRequest,
	UpdateFormSchema,
} from "@line-crm/contracts";
import {
	createFormRepository,
	createFriendRepository,
	createLineAccountRepository,
	createScenarioRepository,
	createTagRepository,
} from "@line-crm/db";
import type { FriendId, LineUserId, ScenarioId, TagId } from "@line-crm/domain";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { validateJson } from "../middleware/validate.js";

const forms = new Hono<Env>();

// GET /api/forms — list all forms
forms.get("/api/forms", async (c) => {
	try {
		const db = c.get("db");
		const formRepo = createFormRepository(db);
		const items = await formRepo.list();
		return c.json({ success: true, data: items });
	} catch (err) {
		console.error("GET /api/forms error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/forms/:id — get form
forms.get("/api/forms/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const formRepo = createFormRepository(db);
		const form = await formRepo.findById(id);
		if (!form) {
			return c.json({ success: false, error: "Form not found" }, 404);
		}
		return c.json({ success: true, data: form });
	} catch (err) {
		console.error("GET /api/forms/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// POST /api/forms — create form
forms.post("/api/forms", validateJson(CreateFormSchema), async (c) => {
	try {
		const body: CreateFormRequest = c.req.valid("json");

		const db = c.get("db");
		const formRepo = createFormRepository(db);
		const formId = await formRepo.create({
			name: body.name,
			description: body.description ?? null,
			fields: JSON.stringify(body.fields ?? []),
			onSubmitTagId: body.onSubmitTagId ?? null,
			onSubmitScenarioId: body.onSubmitScenarioId ?? null,
			saveToMetadata: body.saveToMetadata,
		});

		const form = await formRepo.findById(formId);
		return c.json({ success: true, data: form }, 201);
	} catch (err) {
		console.error("POST /api/forms error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// PUT /api/forms/:id — update form
forms.put("/api/forms/:id", validateJson(UpdateFormSchema), async (c) => {
	try {
		const id = c.req.param("id");
		const body: UpdateFormRequest = c.req.valid("json");

		const db = c.get("db");
		const formRepo = createFormRepository(db);
		await formRepo.update(id, {
			name: body.name,
			description: body.description,
			fields: body.fields !== undefined ? JSON.stringify(body.fields) : undefined,
			onSubmitTagId: body.onSubmitTagId,
			onSubmitScenarioId: body.onSubmitScenarioId,
			saveToMetadata: body.saveToMetadata,
			isActive: body.isActive,
		});

		const updated = await formRepo.findById(id);
		if (!updated) {
			return c.json({ success: false, error: "Form not found" }, 404);
		}

		return c.json({ success: true, data: updated });
	} catch (err) {
		console.error("PUT /api/forms/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// DELETE /api/forms/:id
forms.delete("/api/forms/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const formRepo = createFormRepository(db);
		const form = await formRepo.findById(id);
		if (!form) {
			return c.json({ success: false, error: "Form not found" }, 404);
		}
		await formRepo.delete(id);
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/forms/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// GET /api/forms/:id/submissions — list submissions
forms.get("/api/forms/:id/submissions", async (c) => {
	try {
		const id = c.req.param("id");
		const db = c.get("db");
		const formRepo = createFormRepository(db);
		const form = await formRepo.findById(id);
		if (!form) {
			return c.json({ success: false, error: "Form not found" }, 404);
		}
		const submissions = await formRepo.getSubmissions(id);
		return c.json({ success: true, data: submissions });
	} catch (err) {
		console.error("GET /api/forms/:id/submissions error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

/**
 * Execute form submission side effects: metadata save, tagging, scenario enrollment, and confirmation message.
 * Best-effort -- failures are logged but do not fail the request.
 */
async function executeFormSideEffects(
	db: D1Database,
	form: Record<string, unknown>,
	friendId: string,
	submissionData: Record<string, unknown>,
	lineChannelAccessToken: string,
	drizzleDb: import("@line-crm/db").Database,
): Promise<void> {
	const sideEffects: Promise<unknown>[] = [];
	const friendRepo = createFriendRepository(drizzleDb);

	// Save response data to friend's metadata
	const saveToMeta = form.save_to_metadata ?? form.saveToMetadata;
	if (saveToMeta) {
		sideEffects.push(
			(async () => {
				const friend = await friendRepo.findById(friendId as FriendId);
				if (!friend) return;
				const existing = JSON.parse(friend.metadata || "{}") as Record<string, unknown>;
				const merged = { ...existing, ...submissionData };
				await friendRepo.updateMetadata(friendId as FriendId, merged);
			})(),
		);
	}

	// Add tag
	const onSubmitTagId = (form.on_submit_tag_id ?? form.onSubmitTagId) as string | null;
	if (onSubmitTagId) {
		const tagRepo = createTagRepository(drizzleDb);
		sideEffects.push(tagRepo.assignToFriend(friendId as FriendId, onSubmitTagId as TagId));
	}

	// Enroll in scenario
	const onSubmitScenarioId = (form.on_submit_scenario_id ?? form.onSubmitScenarioId) as string | null;
	if (onSubmitScenarioId) {
		const scenarioRepo = createScenarioRepository(drizzleDb);
		sideEffects.push(scenarioRepo.enrollFriend(friendId as FriendId, onSubmitScenarioId as ScenarioId, null));
	}

	// Send confirmation message with submitted data back to user
	sideEffects.push(sendFormConfirmationMessage(db, form, friendId, submissionData, lineChannelAccessToken, drizzleDb));

	const results = await Promise.allSettled(sideEffects);
	for (const r of results) {
		if (r.status === "rejected") console.error("Form side-effect failed:", r.reason);
	}
}

/**
 * Send a Flex confirmation message with the submitted form answers back to the user via LINE push.
 */
async function sendFormConfirmationMessage(
	_db: D1Database,
	form: Record<string, unknown>,
	friendId: string,
	submissionData: Record<string, unknown>,
	lineChannelAccessToken: string,
	drizzleDb: import("@line-crm/db").Database,
): Promise<void> {
	console.log("Form reply: starting for friendId", friendId);
	const friendRepo = createFriendRepository(drizzleDb);
	const friend = await friendRepo.findById(friendId as FriendId);
	if (!friend?.lineUserId) {
		console.log("Form reply: no line_user_id");
		return;
	}
	console.log("Form reply: sending to", friend.lineUserId);
	const { LineClient } = await import("@line-crm/line-sdk");
	// Resolve access token from friend's account (multi-account support)
	let accessToken = lineChannelAccessToken;
	if (friend.lineAccountId) {
		const accountRepo = createLineAccountRepository(drizzleDb);
		const account = await accountRepo.findById(friend.lineAccountId as import("@line-crm/domain").LineAccountId);
		if (account) accessToken = (account as unknown as Record<string, unknown>).channelAccessToken as string;
	}
	const lineClient = new LineClient(accessToken);

	const flex = buildConfirmationFlex(form, { display_name: friend.displayName }, submissionData);

	const { buildMessage } = await import("../services/step-delivery.js");
	await lineClient.pushMessage(friend.lineUserId, [buildMessage("flex", JSON.stringify(flex))]);
}

/**
 * Build a Flex Bubble showing the submitted form answers.
 */
function buildConfirmationFlex(
	form: Record<string, unknown>,
	friend: { display_name: string | null },
	submissionData: Record<string, unknown>,
) {
	const entries = Object.entries(submissionData);
	const rawFields = form.fields;
	const parsedFields = typeof rawFields === "string" ? rawFields : null;
	const answerRows = entries.map(([key, value]) => {
		const field = parsedFields
			? (JSON.parse(parsedFields) as Array<{ name: string; label: string }>).find(
					(f: { name: string }) => f.name === key,
				)
			: null;
		const label = field?.label || key;
		const val = Array.isArray(value)
			? value.join(", ")
			: value !== null && value !== undefined && value !== ""
				? String(value)
				: "-";
		return {
			type: "box" as const,
			layout: "vertical" as const,
			margin: "md" as const,
			contents: [
				{ type: "text" as const, text: label, size: "xxs" as const, color: "#64748b" },
				{
					type: "text" as const,
					text: val,
					size: "sm" as const,
					color: "#1e293b",
					weight: "bold" as const,
					wrap: true,
				},
			],
		};
	});

	return {
		type: "bubble",
		size: "giga",
		header: {
			type: "box",
			layout: "vertical",
			contents: [
				{ type: "text", text: "診断結果", size: "lg", weight: "bold", color: "#1e293b" },
				{
					type: "text",
					text: `${friend.display_name ?? ""}さんのプロフィール`,
					size: "xs",
					color: "#64748b",
					margin: "sm",
				},
			],
			paddingAll: "20px",
			backgroundColor: "#f0fdf4",
		},
		body: {
			type: "box",
			layout: "vertical",
			contents: [
				...answerRows,
				{ type: "separator", margin: "lg" },
				...((form.save_to_metadata ?? form.saveToMetadata)
					? [
							{
								type: "box",
								layout: "vertical",
								margin: "lg",
								backgroundColor: "#eff6ff",
								cornerRadius: "md",
								paddingAll: "12px",
								contents: [
									{
										type: "text",
										text: "メタデータに自動保存済み。今後の配信があなたに最適化されます。",
										size: "xxs",
										color: "#2563EB",
										wrap: true,
									},
								],
							},
						]
					: []),
			],
			paddingAll: "20px",
		},
		footer: {
			type: "box",
			layout: "vertical",
			paddingAll: "16px",
			contents: [
				{
					type: "button",
					action: { type: "message", label: "アカウント連携を見る", text: "アカウント連携を見る" },
					style: "primary",
					color: "#14b8a6",
				},
			],
		},
	};
}

// POST /api/forms/:id/submit — submit form (public, used by LIFF)
forms.post("/api/forms/:id/submit", async (c) => {
	try {
		const formId = c.req.param("id");
		const drizzleDb = c.get("db");
		const formRepo = createFormRepository(drizzleDb);
		const form = await formRepo.findById(formId);
		if (!form) {
			return c.json({ success: false, error: "Form not found" }, 404);
		}
		const formRecord = form as unknown as Record<string, unknown>;
		if (!(formRecord.is_active ?? formRecord.isActive)) {
			return c.json({ success: false, error: "This form is no longer accepting responses" }, 400);
		}

		const body: SubmitFormRequest = await c.req.json();

		const submissionData = body.data ?? {};

		// Validate required fields
		const rawFields = (formRecord.fields ?? "[]") as string;
		const fields = (typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields) as Array<{
			name: string;
			label: string;
			type: string;
			required?: boolean;
		}>;

		for (const field of fields) {
			if (field.required) {
				const val = submissionData[field.name];
				if (val === undefined || val === null || val === "") {
					return c.json({ success: false, error: `${field.label} は必須項目です` }, 400);
				}
			}
		}

		// Resolve friend by lineUserId or friendId
		let friendId: string | null = body.friendId ?? null;
		if (!friendId && body.lineUserId) {
			const friendRepo = createFriendRepository(drizzleDb);
			const friend = await friendRepo.findByLineUserId(body.lineUserId as LineUserId);
			if (friend) {
				friendId = friend.id;
			}
		}

		// Save submission (friendId null if not resolved — avoids FK constraint)
		const submissionId = await formRepo.createSubmission({
			formId,
			friendId: friendId ?? null,
			data: JSON.stringify(submissionData),
		});

		// Side effects (best-effort, don't fail the request)
		if (friendId) {
			await executeFormSideEffects(
				c.env.DB,
				formRecord,
				friendId,
				submissionData,
				c.env.LINE_CHANNEL_ACCESS_TOKEN,
				drizzleDb,
			);
		}

		return c.json({ success: true, data: { id: submissionId } }, 201);
	} catch (err) {
		console.error("POST /api/forms/:id/submit error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { forms };
