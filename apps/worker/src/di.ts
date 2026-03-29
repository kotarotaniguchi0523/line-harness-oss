// =============================================================================
// Dependency Injection Container — hono-simple-di
// =============================================================================
// 全サービスの依存関係をここで宣言的に定義。
// ルートハンドラは c.var.friendService のように型安全にアクセス。
//
// Scope:
//   "default"  = シングルトン (Workers isolate ライフタイム)
//   "request"  = リクエストごとに生成

import { createDb, type Database } from "@line-crm/db/drizzle";
import { createAudienceRepository } from "@line-crm/db/repositories/audience.repository";
import { createAutoReplyRepository } from "@line-crm/db/repositories/auto-reply.repository";
import { createAutomationRepository } from "@line-crm/db/repositories/automation.repository";
import { createBroadcastRepository } from "@line-crm/db/repositories/broadcast.repository";
import { createChatRepository } from "@line-crm/db/repositories/chat.repository";
import { createDeliveryLogRepository } from "@line-crm/db/repositories/delivery-log.repository";
import { createFriendRepository } from "@line-crm/db/repositories/friend.repository";
import { createGroupChatRepository } from "@line-crm/db/repositories/group-chat.repository";
import { createReminderRepository } from "@line-crm/db/repositories/reminder.repository";
import { createScenarioRepository } from "@line-crm/db/repositories/scenario.repository";
import { createScoringRepository } from "@line-crm/db/repositories/scoring.repository";
import { createTagRepository } from "@line-crm/db/repositories/tag.repository";
import { Dependency } from "hono-simple-di";
import { createCacheService } from "./services/cache.service.js";
import { createFriendService } from "./services/friend.service.js";
import { createMediaStorageService } from "./services/media-storage.service.js";
import { createScenarioService } from "./services/scenario.service.js";

// ---------------------------------------------------------------------------
// Infrastructure Dependencies (request scope — D1 binding per request)
// ---------------------------------------------------------------------------

/** Drizzle Database instance */
export const dbDep = new Dependency((c) => createDb(c.env.DB) as Database, { scope: "request" });

/** KV Cache service */
export const cacheDep = new Dependency((c) => createCacheService(c.env.CACHE), { scope: "request" });

/** R2 Media storage service */
export const mediaDep = new Dependency((c) => createMediaStorageService(c.env.MEDIA_BUCKET, c.env.WORKER_URL), {
	scope: "request",
});

// ---------------------------------------------------------------------------
// Repository Dependencies (request scope — depend on db)
// ---------------------------------------------------------------------------

export const friendRepoDep = new Dependency(async (c) => createFriendRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const scenarioRepoDep = new Dependency(async (c) => createScenarioRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const broadcastRepoDep = new Dependency(async (c) => createBroadcastRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const tagRepoDep = new Dependency(async (c) => createTagRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const automationRepoDep = new Dependency(async (c) => createAutomationRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const chatRepoDep = new Dependency(async (c) => createChatRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const scoringRepoDep = new Dependency(async (c) => createScoringRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const reminderRepoDep = new Dependency(async (c) => createReminderRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const deliveryLogRepoDep = new Dependency(async (c) => createDeliveryLogRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const audienceRepoDep = new Dependency(async (c) => createAudienceRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const autoReplyRepoDep = new Dependency(async (c) => createAutoReplyRepository(await dbDep.resolve(c)), {
	scope: "request",
});

export const groupChatRepoDep = new Dependency(async (c) => createGroupChatRepository(await dbDep.resolve(c)), {
	scope: "request",
});

// ---------------------------------------------------------------------------
// Application Service Dependencies (request scope — depend on db)
// ---------------------------------------------------------------------------

/** CRM: Friend queries + commands (CQRS) */
export const friendServiceDep = new Dependency(async (c) => createFriendService(await dbDep.resolve(c)), {
	scope: "request",
});

/** Marketing: Scenario queries + commands (CQRS) */
export const scenarioServiceDep = new Dependency(async (c) => createScenarioService(await dbDep.resolve(c)), {
	scope: "request",
});
