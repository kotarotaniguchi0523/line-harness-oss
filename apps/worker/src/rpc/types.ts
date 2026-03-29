import type { StaffRole } from "@line-crm/contracts";

/**
 * Staff context passed from authentication middleware to RPC targets and services.
 * Single definition: import this from `rpc/types.ts` everywhere.
 */
export interface StaffContext {
	readonly id: string;
	readonly name: string;
	readonly role: StaffRole;
}

/** Roles allowed to perform write (mutating) operations */
export const WRITE_ROLES: ReadonlyArray<StaffRole> = ["owner", "admin"] as const;

/** Roles allowed to perform read operations */
export const READ_ROLES: ReadonlyArray<StaffRole> = ["owner", "admin", "staff"] as const;
