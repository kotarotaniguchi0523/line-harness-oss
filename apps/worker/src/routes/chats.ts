import {
	type CreateChatRequest,
	CreateChatSchema,
	type CreateOperatorRequest,
	CreateOperatorSchema,
	SendChatMessageSchema,
	type UpdateChatRequest,
	UpdateChatSchema,
} from "@line-crm/contracts";
import {
	createChatRepository,
	createFriendRepository,
	createOperator,
	DateTime,
	deleteOperator,
	getOperatorById,
	getOperators,
	updateOperator,
} from "@line-crm/db";
import { chats, friends, messagesLog } from "@line-crm/db/schema";
import type { ChatId, FriendId, OperatorId } from "@line-crm/domain";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Env } from "../index.js";
import { validateJson } from "../middleware/validate.js";

const chatsRoute = new Hono<Env>();

// ========== オペレーターCRUD ==========

chatsRoute.get("/api/operators", async (c) => {
	try {
		const items = await getOperators(c.env.DB);
		return c.json({
			success: true,
			data: items.map((o) => ({
				id: o.id,
				name: o.name,
				email: o.email,
				role: o.role,
				isActive: Boolean(o.is_active),
				createdAt: o.created_at,
				updatedAt: o.updated_at,
			})),
		});
	} catch (err) {
		console.error("GET /api/operators error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

chatsRoute.post("/api/operators", validateJson(CreateOperatorSchema), async (c) => {
	try {
		const body: CreateOperatorRequest = c.req.valid("json");
		const item = await createOperator(c.env.DB, body);
		return c.json({ success: true, data: { id: item.id, name: item.name, email: item.email, role: item.role } }, 201);
	} catch (err) {
		console.error("POST /api/operators error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

chatsRoute.put("/api/operators/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();
		await updateOperator(c.env.DB, id, body);
		const updated = await getOperatorById(c.env.DB, id);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({
			success: true,
			data: {
				id: updated.id,
				name: updated.name,
				email: updated.email,
				role: updated.role,
				isActive: Boolean(updated.is_active),
			},
		});
	} catch (err) {
		console.error("PUT /api/operators/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

chatsRoute.delete("/api/operators/:id", async (c) => {
	try {
		await deleteOperator(c.env.DB, c.req.param("id"));
		return c.json({ success: true, data: null });
	} catch (err) {
		console.error("DELETE /api/operators/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// ========== チャットCRUD ==========

chatsRoute.get("/api/chats", async (c) => {
	try {
		const status = c.req.query("status") ?? undefined;
		const operatorId = c.req.query("operatorId") ?? undefined;
		const lineAccountId = c.req.query("lineAccountId") ?? undefined;

		const db = c.get("db");

		// JOIN friends to get display_name and picture_url via Drizzle
		const conditions: ReturnType<typeof eq>[] = [];
		if (status) conditions.push(eq(chats.status, status));
		if (operatorId) conditions.push(eq(chats.operatorId, operatorId));
		if (lineAccountId) conditions.push(eq(friends.lineAccountId, lineAccountId));

		const rows = await db
			.select({
				id: chats.id,
				friendId: chats.friendId,
				displayName: friends.displayName,
				pictureUrl: friends.pictureUrl,
				lineUserId: friends.lineUserId,
				operatorId: chats.operatorId,
				status: chats.status,
				notes: chats.notes,
				lastMessageAt: chats.lastMessageAt,
				createdAt: chats.createdAt,
				updatedAt: chats.updatedAt,
			})
			.from(chats)
			.leftJoin(friends, eq(chats.friendId, friends.id))
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(chats.lastMessageAt));

		return c.json({
			success: true,
			data: rows.map((ch) => ({
				id: ch.id,
				friendId: ch.friendId,
				friendName: ch.displayName || "名前なし",
				friendPictureUrl: ch.pictureUrl || null,
				operatorId: ch.operatorId,
				status: ch.status,
				notes: ch.notes,
				lastMessageAt: ch.lastMessageAt,
				createdAt: ch.createdAt,
				updatedAt: ch.updatedAt,
			})),
		});
	} catch (err) {
		console.error("GET /api/chats error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

chatsRoute.get("/api/chats/:id", async (c) => {
	try {
		const db = c.get("db");
		const chatRepo = createChatRepository(db);
		const friendRepo = createFriendRepository(db);

		const item = await chatRepo.getChatDetail(c.req.param("id") as ChatId);
		if (!item) return c.json({ success: false, error: "Chat not found" }, 404);

		// 友だち情報を取得
		const friend = item.friendId ? await friendRepo.findById(item.friendId as FriendId) : null;

		// チャットに関連するメッセージログも取得 (Drizzle)
		const messageRows = await db
			.select({
				id: messagesLog.id,
				friendId: messagesLog.friendId,
				direction: messagesLog.direction,
				messageType: messagesLog.messageType,
				content: messagesLog.content,
				createdAt: messagesLog.createdAt,
			})
			.from(messagesLog)
			.where(item.friendId ? eq(messagesLog.friendId, item.friendId) : undefined)
			.orderBy(messagesLog.createdAt)
			.limit(200);

		return c.json({
			success: true,
			data: {
				id: item.id,
				friendId: item.friendId,
				friendName: friend?.displayName || "名前なし",
				friendPictureUrl: friend?.pictureUrl || null,
				operatorId: item.operatorId,
				status: item.status,
				notes: item.notes,
				lastMessageAt: item.lastMessageAt,
				createdAt: item.createdAt,
				messages: messageRows.map((m) => ({
					id: m.id,
					direction: m.direction,
					messageType: m.messageType,
					content: m.content,
					createdAt: m.createdAt,
				})),
			},
		});
	} catch (err) {
		console.error("GET /api/chats/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

chatsRoute.post("/api/chats", validateJson(CreateChatSchema), async (c) => {
	try {
		const db = c.get("db");
		const chatRepo = createChatRepository(db);
		const body: CreateChatRequest = c.req.valid("json");

		const chatId = await chatRepo.createChat({
			friendId: body.friendId as FriendId,
			operatorId: body.operatorId as OperatorId | undefined,
		});

		return c.json({ success: true, data: { id: chatId, friendId: body.friendId, status: "unread" } }, 201);
	} catch (err) {
		console.error("POST /api/chats error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// チャットのアサイン/ステータス更新/ノート更新
chatsRoute.put("/api/chats/:id", validateJson(UpdateChatSchema), async (c) => {
	try {
		const db = c.get("db");
		const chatRepo = createChatRepository(db);
		const id = c.req.param("id");
		const body: UpdateChatRequest = c.req.valid("json");

		await chatRepo.updateChatStatus(id as ChatId, {
			operatorId: body.operatorId,
			status: body.status,
			notes: body.notes,
		});
		const updated = await chatRepo.getChatDetail(id as ChatId);
		if (!updated) return c.json({ success: false, error: "Not found" }, 404);
		return c.json({
			success: true,
			data: {
				id: updated.id,
				friendId: updated.friendId,
				operatorId: updated.operatorId,
				status: updated.status,
				notes: updated.notes,
			},
		});
	} catch (err) {
		console.error("PUT /api/chats/:id error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

// オペレーターからメッセージ送信
chatsRoute.post("/api/chats/:id/send", validateJson(SendChatMessageSchema), async (c) => {
	try {
		const db = c.get("db");
		const chatRepo = createChatRepository(db);
		const friendRepo = createFriendRepository(db);

		const chatId = c.req.param("id");
		const chat = await chatRepo.getChatDetail(chatId as ChatId);
		if (!chat) return c.json({ success: false, error: "Chat not found" }, 404);

		const body = c.req.valid("json");

		const friend = chat.friendId ? await friendRepo.findById(chat.friendId as FriendId) : null;
		if (!friend) return c.json({ success: false, error: "Friend not found" }, 404);

		// LINE APIでメッセージ送信
		const { LineClient } = await import("@line-crm/line-sdk");
		const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
		const messageType = body.messageType ?? "text";

		if (messageType === "text") {
			await lineClient.pushTextMessage(friend.lineUserId, body.content);
		} else if (messageType === "flex") {
			const contents = JSON.parse(body.content);
			await lineClient.pushFlexMessage(friend.lineUserId, "Message", contents);
		}

		// メッセージログに記録
		await friendRepo.logMessage({
			friendId: friend.id,
			direction: "outgoing",
			messageType,
			content: body.content,
		});

		// チャットの最終メッセージ日時を更新
		await chatRepo.updateChatStatus(chatId as ChatId, { status: "in_progress", lastMessageAt: DateTime.now().toISO() });

		return c.json({ success: true, data: { sent: true } });
	} catch (err) {
		console.error("POST /api/chats/:id/send error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export { chatsRoute as chats };
