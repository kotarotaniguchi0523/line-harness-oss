import { MIDDLEWARE_LIMITS } from "@line-crm/contracts";
import { createStripeEvent, createTagRepository, getStripeEventByStripeId, getStripeEvents } from "@line-crm/db";
import type { FriendId, TagId } from "@line-crm/domain";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import type { Env } from "../index.js";

const stripe = new Hono<Env>();

interface StripeWebhookBody {
	id: string;
	type: string;
	data: {
		object: {
			id: string;
			amount?: number;
			currency?: string;
			metadata?: Record<string, string>;
			customer?: string;
			status?: string;
		};
	};
}

// ========== Stripeイベント一覧 ==========

stripe.get("/api/integrations/stripe/events", async (c) => {
	try {
		const friendId = c.req.query("friendId") ?? undefined;
		const eventType = c.req.query("eventType") ?? undefined;
		const limit = Number(c.req.query("limit") ?? "100");
		const items = await getStripeEvents(c.env.DB, { friendId, eventType, limit });
		return c.json({
			success: true,
			data: items.map((e) => ({
				id: e.id,
				stripeEventId: e.stripe_event_id,
				eventType: e.event_type,
				friendId: e.friend_id,
				amount: e.amount,
				currency: e.currency,
				metadata: e.metadata ? JSON.parse(e.metadata) : null,
				processedAt: e.processed_at,
			})),
		});
	} catch (err) {
		console.error("GET /api/integrations/stripe/events error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== Stripe Webhookレシーバー ==========

/** Maximum allowed age of a Stripe webhook signature timestamp (in seconds). */
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verify Stripe webhook signature using HMAC-SHA256 via crypto.subtle.
 *
 * Stripe sends the header `Stripe-Signature` in the format:
 *   t=<unix_timestamp>,v1=<hex_hmac_sha256>
 *
 * The signed payload is `${timestamp}.${rawBody}`.
 * This function also enforces a 5-minute timestamp tolerance to prevent
 * replay attacks using stale captured payloads.
 */
async function verifyStripeSignature(secret: string, rawBody: string, sigHeader: string): Promise<boolean> {
	// Parse Stripe signature header: t=timestamp,v1=signature
	const parts = Object.fromEntries(
		sigHeader.split(",").map((p) => {
			const [k, ...v] = p.split("=");
			return [k, v.join("=")];
		}),
	);
	const timestamp = parts.t;
	const expectedSig = parts.v1;
	if (!(timestamp && expectedSig)) return false;

	// Enforce timestamp tolerance to prevent replay attacks
	const timestampSeconds = Number(timestamp);
	if (Number.isNaN(timestampSeconds)) return false;
	const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
	if (ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;

	// Compute HMAC-SHA256 of the signed payload using Cloudflare Workers crypto.subtle
	const encoder = new TextEncoder();
	const signedPayload = `${timestamp}.${rawBody}`;
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
	const computedSig = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Constant-length comparison (both are hex strings of the same HMAC output)
	if (computedSig.length !== expectedSig.length) return false;
	let mismatch = 0;
	for (let i = 0; i < computedSig.length; i++) {
		mismatch |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
	}
	return mismatch === 0;
}

stripe.post("/api/integrations/stripe/webhook", timeout(MIDDLEWARE_LIMITS.stripeWebhookTimeoutMs), async (c) => {
	try {
		const stripeSecret = c.env.STRIPE_WEBHOOK_SECRET;
		let body: StripeWebhookBody;

		if (stripeSecret) {
			// 署名検証モード（本番環境）
			const sigHeader = c.req.header("Stripe-Signature") ?? "";
			const rawBody = await c.req.text();

			const valid = await verifyStripeSignature(stripeSecret, rawBody, sigHeader);
			if (!valid) {
				return c.json({ success: false, error: "Stripe signature verification failed" }, 401);
			}
			body = JSON.parse(rawBody) as StripeWebhookBody;
		} else {
			// シークレット未設定（開発環境向け）
			body = await c.req.json<StripeWebhookBody>();
		}

		// 冪等性チェック
		const existing = await getStripeEventByStripeId(c.env.DB, body.id);
		if (existing) {
			return c.json({ success: true, data: { message: "Already processed" } });
		}

		const obj = body.data.object;
		const db = c.env.DB;

		// メタデータからfriendIdを取得（Stripeのメタデータにline_friend_idを設定している想定）
		const friendId = obj.metadata?.line_friend_id ?? null;

		// イベントを記録
		const event = await createStripeEvent(db, {
			stripeEventId: body.id,
			eventType: body.type,
			friendId: friendId ?? undefined,
			amount: obj.amount,
			currency: obj.currency,
			metadata: JSON.stringify(obj.metadata ?? {}),
		});

		// 決済成功時の自動処理
		if (body.type === "payment_intent.succeeded" && friendId) {
			const { applyScoring } = await import("@line-crm/db");
			await applyScoring(db, friendId, "purchase");

			// 自動タグ付け（product_idベース）
			const drizzleDb = c.get("db");
			const tagRepo = createTagRepository(drizzleDb);

			const productId = obj.metadata?.product_id;
			if (productId) {
				// TODO: Migrate to tagRepo.findByName() once available
				const tag = await db
					.prepare("SELECT id FROM tags WHERE name = ?")
					.bind(`purchased_${productId}`)
					.first<{ id: string }>();
				if (tag) {
					await tagRepo.assignToFriend(friendId as FriendId, tag.id as TagId);
				}
			}

			// イベントバスに発火（自動化ルール用）
			const { fireEvent } = await import("../services/event-bus.js");
			await fireEvent(db, "cv_fire", {
				friendId,
				eventData: { type: "purchase", amount: obj.amount, stripeEventId: body.id },
			});
		}

		// サブスクリプションイベント処理
		if (body.type === "customer.subscription.deleted" && friendId) {
			const drizzleDb = c.get("db");
			const tagRepo = createTagRepository(drizzleDb);
			// TODO: Migrate to tagRepo.findByName() once available
			const cancelledTag = await db
				.prepare(`SELECT id FROM tags WHERE name = 'subscription_cancelled'`)
				.first<{ id: string }>();
			if (cancelledTag) {
				await tagRepo.assignToFriend(friendId as FriendId, cancelledTag.id as TagId);
			}
		}

		return c.json({
			success: true,
			data: {
				id: event.id,
				stripeEventId: event.stripe_event_id,
				eventType: event.event_type,
				processedAt: event.processed_at,
			},
		});
	} catch (err) {
		console.error("POST /api/integrations/stripe/webhook error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { stripe };
