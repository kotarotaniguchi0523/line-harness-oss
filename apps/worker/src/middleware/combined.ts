// =============================================================================
// Combined Middleware Presets — よく使う組み合わせを宣言的に定義
// =============================================================================
// 各ルートが個別に8個のミドルウェアを並べる代わりに、
// 用途別のプリセットを使う。DI はこのファイルで注入。

import { MIDDLEWARE_LIMITS } from "@line-crm/contracts";
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import {
	audienceRepoDep,
	automationRepoDep,
	autoReplyRepoDep,
	broadcastRepoDep,
	cacheDep,
	chatRepoDep,
	dbDep,
	deliveryLogRepoDep,
	friendServiceDep,
	groupChatRepoDep,
	mediaDep,
	reminderRepoDep,
	scenarioServiceDep,
	scoringRepoDep,
	tagRepoDep,
} from "../di.js";
import type { Env } from "../index.js";
import { authMiddleware } from "./auth.js";
import { backgroundContextMiddleware } from "./background.js";
import { structuredLogger } from "./structured-logger.js";

// ---------------------------------------------------------------------------
// Base: 全リクエスト共通 (認証不要のエンドポイントでも適用)
// ---------------------------------------------------------------------------

export function applyBaseMiddleware(app: Hono<Env>): void {
	// Infrastructure
	app.use("*", requestId());
	app.use("*", structuredLogger);
	app.use("*", timing());
	app.use("*", secureHeaders());
	app.use("*", cors({ origin: "*" }));

	// Body size protection (DoS defense)
	app.use("*", bodyLimit({ maxSize: MIDDLEWARE_LIMITS.defaultBodyMaxBytes }));

	// ETag for conditional GET (bandwidth reduction)
	app.use("*", etag());

	// DI: DB + Cache (全ルートで利用可能)
	app.use("*", dbDep.middleware("db"));
	app.use("*", cacheDep.middleware("cache"));

	// Background context — c.get('executionCtx') and c.get('jobQueue') for waitUntil
	app.use("*", backgroundContextMiddleware);
}

// ---------------------------------------------------------------------------
// Authenticated: 認証必須 + DI サービス注入
// ---------------------------------------------------------------------------

export function applyAuthenticatedMiddleware(app: Hono<Env>): void {
	app.use("*", authMiddleware);

	// Application Services (CQRS)
	app.use("*", friendServiceDep.middleware("friendService"));
	app.use("*", scenarioServiceDep.middleware("scenarioService"));

	// Repositories (直接アクセスが必要なルート用)
	app.use("*", broadcastRepoDep.middleware("broadcastRepo"));
	app.use("*", tagRepoDep.middleware("tagRepo"));
	app.use("*", automationRepoDep.middleware("automationRepo"));
	app.use("*", chatRepoDep.middleware("chatRepo"));
	app.use("*", scoringRepoDep.middleware("scoringRepo"));
	app.use("*", reminderRepoDep.middleware("reminderRepo"));
	app.use("*", deliveryLogRepoDep.middleware("deliveryLogRepo"));
	app.use("*", audienceRepoDep.middleware("audienceRepo"));
	app.use("*", autoReplyRepoDep.middleware("autoReplyRepo"));
	app.use("*", groupChatRepoDep.middleware("groupChatRepo"));
	app.use("*", mediaDep.middleware("mediaStorage"));
}

// ---------------------------------------------------------------------------
// Webhook: 認証なし (LINE署名検証はルート内で実施)、DB + Cache のみ
// ---------------------------------------------------------------------------
// webhook は applyBaseMiddleware のみで十分。
// 認証ミドルウェアとサービスDIは不要（LINE署名検証がルート内で行われる）。

// ---------------------------------------------------------------------------
// Public: 認証不要の公開エンドポイント (LIFF, affiliate click, forms等)
// ---------------------------------------------------------------------------
// applyBaseMiddleware のみ。authMiddleware はスキップ。
