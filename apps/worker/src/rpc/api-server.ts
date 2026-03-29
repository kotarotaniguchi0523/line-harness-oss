// =============================================================================
// Cap'n Web RPC Server - Object-Capability Authentication
// =============================================================================

import { createDb, type Database } from "@line-crm/db/drizzle";
import { staffMembers } from "@line-crm/db/schema";
import { newWorkersRpcResponse, RpcTarget } from "capnweb";
import { and, eq } from "drizzle-orm";
import { FriendsRpc } from "./friends.rpc.js";
import { ScenariosRpc } from "./scenarios.rpc.js";

interface WorkerEnv {
	DB: D1Database;
	API_KEY: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	LINE_CHANNEL_SECRET: string;
	WORKER_URL?: string;
	LIFF_URL?: string;
}

import type { StaffRole } from "@line-crm/contracts";
import type { StaffContext } from "./types.js";

/**
 * Root RPC server - unauthenticated entry point.
 * Call authenticate() to get an AuthenticatedSession capability.
 */
class ApiServer extends RpcTarget {
	private db: Database;

	constructor(private workerEnv: WorkerEnv) {
		super();
		this.db = createDb(workerEnv.DB);
	}

	/**
	 * Authenticate with API key/session token.
	 * Returns an AuthenticatedSession capability object.
	 * Cap'n Web ensures the client cannot forge this object.
	 */
	async authenticate(apiKeyOrToken: string): Promise<AuthenticatedSession> {
		// Check staff_members table first
		const [staff] = await this.db
			.select({
				id: staffMembers.id,
				name: staffMembers.name,
				role: staffMembers.role,
			})
			.from(staffMembers)
			.where(and(eq(staffMembers.apiKey, apiKeyOrToken), eq(staffMembers.isActive, true)));

		if (staff) {
			return new AuthenticatedSession(this.db, this.workerEnv, {
				id: staff.id,
				name: staff.name,
				role: staff.role as StaffRole,
			});
		}

		// Fallback to environment API_KEY (owner)
		if (apiKeyOrToken === this.workerEnv.API_KEY) {
			return new AuthenticatedSession(this.db, this.workerEnv, {
				id: "env-owner",
				name: "Owner",
				role: "owner",
			});
		}

		throw new Error("Invalid API key");
	}
}

/**
 * Authenticated session - capability delegator.
 * Each domain gets its own RpcTarget class.
 */
class AuthenticatedSession extends RpcTarget {
	constructor(
		private db: Database,
		_workerEnv: WorkerEnv,
		private staff: StaffContext,
	) {
		super();
	}

	/** Get current staff profile */
	whoami(): StaffContext {
		return this.staff;
	}

	/** Friends domain capability */
	friends(): FriendsRpc {
		return new FriendsRpc(this.db, this.staff);
	}

	/** Scenarios domain capability */
	scenarios(): ScenariosRpc {
		return new ScenariosRpc(this.db, this.staff);
	}

	// Additional domain capabilities will be added as they're implemented:
	// broadcasts(): BroadcastsRpc { ... }
	// chats(): ChatsRpc { ... }
	// automations(): AutomationsRpc { ... }
	// etc.
}

/**
 * Create Cap'n Web RPC response for Cloudflare Workers
 */
export function handleRpcRequest(request: Request, workerEnv: WorkerEnv): Response {
	return newWorkersRpcResponse(request, new ApiServer(workerEnv)) as unknown as Response;
}
