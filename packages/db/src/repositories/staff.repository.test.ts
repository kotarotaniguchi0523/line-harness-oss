import { beforeEach, describe, expect, it, vi } from "vitest";
import { staffMembers } from "../schema/index.js";
import { createStaffRepository } from "./staff.repository.js";

vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof import("drizzle-orm")>();
	const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		kind: "sql",
		strings: Array.from(strings),
		values,
	}));

	return {
		...actual,
		eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
		and: vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions })),
		asc: vi.fn((value: unknown) => ({ kind: "asc", value })),
		sql: Object.assign(sqlMock, {
			join: vi.fn((items: unknown[], separator: unknown) => ({ kind: "join", items, separator })),
		}),
	};
});

// Import mocked functions after vi.mock
import { and, eq } from "drizzle-orm";

function createSelectWhereChain<T>(result: T[]) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(result),
	};
}

function buildStaff(id: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		name: "田中太郎",
		email: "tanaka@example.com",
		role: "admin",
		apiKey: "lh_abc123",
		isActive: true,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("StaffRepository.findByEmail", () => {
	let mockDb: { select: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb = { select: vi.fn() };
	});

	it("staff_findByEmail_activeStaff_shouldReturnStaff", async () => {
		// Arrange
		const expectedStaff = buildStaff("staff-uuid-1");
		mockDb.select.mockReturnValue(createSelectWhereChain([expectedStaff]));
		const repo = createStaffRepository(mockDb as never);

		// Act
		const result = await repo.findByEmail("tanaka@example.com");

		// Assert
		expect(result).toEqual(expectedStaff);
		expect(vi.mocked(eq)).toHaveBeenCalledWith(staffMembers.email, "tanaka@example.com");
		expect(vi.mocked(eq)).toHaveBeenCalledWith(staffMembers.isActive, true);
		expect(vi.mocked(and)).toHaveBeenCalledOnce();
	});

	it("staff_findByEmail_inactiveStaff_shouldReturnNull", async () => {
		// Arrange: DB query with isActive = true filter returns empty (inactive staff filtered out)
		mockDb.select.mockReturnValue(createSelectWhereChain([]));
		const repo = createStaffRepository(mockDb as never);

		// Act
		const result = await repo.findByEmail("inactive@example.com");

		// Assert
		expect(result).toBeNull();
	});

	it("staff_findByEmail_unknownEmail_shouldReturnNull", async () => {
		// Arrange: no matching staff
		mockDb.select.mockReturnValue(createSelectWhereChain([]));
		const repo = createStaffRepository(mockDb as never);

		// Act
		const result = await repo.findByEmail("unknown@example.com");

		// Assert
		expect(result).toBeNull();
	});
});
