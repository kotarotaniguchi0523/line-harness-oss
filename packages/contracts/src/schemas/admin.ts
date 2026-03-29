import { z } from "zod";
import { MigrationStatus, RiskLevel, StaffRole } from "../enums.js";
import { IsoDateSchema, UuidSchema } from "./common.js";

// =============================================================================
// User (Internal UUID System)
// =============================================================================
export const UserSchema = z.object({
	id: UuidSchema,
	email: z.string().email().nullable(),
	phone: z.string().nullable(),
	externalId: z.string().nullable(),
	displayName: z.string().nullable(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
	email: z.string().email().optional(),
	phone: z.string().optional(),
	externalId: z.string().optional(),
	displayName: z.string().optional(),
});

// =============================================================================
// LINE Account
// =============================================================================
export const LineAccountSchema = z.object({
	id: UuidSchema,
	channelId: z.string().min(1),
	name: z.string().min(1),
	channelAccessToken: z.string().min(1),
	channelSecret: z.string().min(1),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type LineAccount = z.infer<typeof LineAccountSchema>;

export const CreateLineAccountSchema = z.object({
	channelId: z.string().min(1),
	name: z.string().min(1),
	channelAccessToken: z.string().min(1),
	channelSecret: z.string().min(1),
});

// =============================================================================
// Staff
// =============================================================================
export const StaffMemberSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	email: z.string().email().nullable(),
	role: StaffRole,
	apiKey: z.string(),
	isActive: z.boolean(),
	createdAt: IsoDateSchema,
	updatedAt: IsoDateSchema,
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;

export const CreateStaffMemberSchema = z.object({
	name: z.string().min(1),
	email: z.string().email().optional(),
	role: StaffRole.exclude(["owner"]),
});

export const StaffProfileSchema = z.object({
	id: UuidSchema,
	name: z.string(),
	role: StaffRole,
	email: z.string().email().nullable(),
});
export type StaffProfile = z.infer<typeof StaffProfileSchema>;

// =============================================================================
// Account Health
// =============================================================================
export const AccountHealthLogSchema = z.object({
	id: UuidSchema,
	lineAccountId: UuidSchema,
	errorCode: z.number().int().nullable(),
	errorCount: z.number().int().nonnegative(),
	checkPeriod: z.string(),
	riskLevel: RiskLevel,
	createdAt: IsoDateSchema,
});
export type AccountHealthLog = z.infer<typeof AccountHealthLogSchema>;

export const AccountMigrationSchema = z.object({
	id: UuidSchema,
	fromAccountId: UuidSchema,
	toAccountId: UuidSchema,
	status: MigrationStatus,
	migratedCount: z.number().int().nonnegative(),
	totalCount: z.number().int().nonnegative(),
	createdAt: IsoDateSchema,
	completedAt: IsoDateSchema.nullable(),
});
export type AccountMigration = z.infer<typeof AccountMigrationSchema>;
