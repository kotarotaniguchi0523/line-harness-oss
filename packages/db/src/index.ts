// =============================================================================
// @line-crm/db — Public barrel (Drizzle repositories + utilities only)
// =============================================================================
// Legacy SQL helper modules (friends.ts, tags.ts, etc.) still exist for
// incremental migration but are NOT re-exported from this barrel.
// All new code should use the Drizzle repositories below.
// =============================================================================

// --- Drizzle DB factory ------------------------------------------------------
// Re-export the real createDb from drizzle.ts (wraps D1 with Drizzle ORM).
export { createDb, type Database } from "./drizzle.js";
export { createAudienceRepository } from "./repositories/audience.repository.js";
export { createAutoReplyRepository } from "./repositories/auto-reply.repository.js";
export { createAutomationRepository } from "./repositories/automation.repository.js";
// --- Drizzle ORM Repositories ------------------------------------------------
export { createBroadcastRepository } from "./repositories/broadcast.repository.js";
export { createChatRepository } from "./repositories/chat.repository.js";
export { createDeliveryLogRepository } from "./repositories/delivery-log.repository.js";
export { createFriendRepository } from "./repositories/friend.repository.js";
export { createGroupChatRepository } from "./repositories/group-chat.repository.js";
export { createReminderRepository } from "./repositories/reminder.repository.js";
export { createScenarioRepository } from "./repositories/scenario.repository.js";
export { createScoringRepository } from "./repositories/scoring.repository.js";
export { createTagRepository } from "./repositories/tag.repository.js";
// --- Utilities ---------------------------------------------------------------
export { DateTime, isTimeBefore, jstNow, toJstString } from "./utils";
