import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	capturedServers,
	createDbMock,
	createFriendQueriesMock,
	createFriendCommandsMock,
	createScenarioQueriesMock,
	createScenarioCommandsMock,
	mockFrom,
	mockSelect,
	mockWhere,
	newWorkersRpcResponseMock,
} = vi.hoisted(() => ({
	capturedServers: [] as Array<{
		authenticate(apiKey: string): Promise<{
			whoami(): unknown;
			friends(): unknown;
			scenarios(): unknown;
		}>;
	}>,
	createDbMock: vi.fn(),
	createFriendQueriesMock: vi.fn(),
	createFriendCommandsMock: vi.fn(),
	createScenarioQueriesMock: vi.fn(),
	createScenarioCommandsMock: vi.fn(),
	mockFrom: vi.fn(),
	mockSelect: vi.fn(),
	mockWhere: vi.fn(),
	newWorkersRpcResponseMock: vi.fn((_request: Request, server: unknown) => {
		capturedServers.push(server as (typeof capturedServers)[number]);
		return new Response(null, { status: 200 });
	}),
}));

vi.mock("capnweb", () => ({
	RpcTarget: class {},
	newWorkersRpcResponse: newWorkersRpcResponseMock,
}));

vi.mock("@line-crm/db/drizzle", () => ({
	createDb: createDbMock,
}));

vi.mock("@line-crm/db/schema", () => ({
	staffMembers: {
		id: "id",
		name: "name",
		role: "role",
		apiKey: "apiKey",
		isActive: "isActive",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
	and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
}));

vi.mock("../services/friend.service.js", () => ({
	createFriendService: (db: unknown) => ({
		queries: createFriendQueriesMock(db),
		commands: createFriendCommandsMock(db),
	}),
}));

vi.mock("../services/scenario.service.js", () => ({
	createScenarioService: (db: unknown) => ({
		queries: createScenarioQueriesMock(db),
		commands: createScenarioCommandsMock(db),
	}),
}));

describe("ApiServer", () => {
	beforeEach(() => {
		capturedServers.length = 0;
		mockWhere.mockReset();
		mockFrom.mockReset();
		mockSelect.mockReset();
		createDbMock.mockReset();
		createFriendQueriesMock.mockReset();
		createFriendCommandsMock.mockReset();
		createScenarioQueriesMock.mockReset();
		createScenarioCommandsMock.mockReset();

		mockSelect.mockReturnValue({ from: mockFrom });
		mockFrom.mockReturnValue({ where: mockWhere });
		createDbMock.mockReturnValue({ select: mockSelect });
		createFriendQueriesMock.mockReturnValue({
			listFriends: vi.fn(),
			getFriend: vi.fn(),
			countFriends: vi.fn(),
		});
		createFriendCommandsMock.mockReturnValue({
			assignTag: vi.fn(),
			removeTag: vi.fn(),
		});
		createScenarioQueriesMock.mockReturnValue({
			listScenarios: vi.fn(),
			getScenario: vi.fn(),
			listActive: vi.fn(),
		});
		createScenarioCommandsMock.mockReturnValue({
			createScenario: vi.fn(),
			addStep: vi.fn(),
			removeStep: vi.fn(),
			setActive: vi.fn(),
			deleteScenario: vi.fn(),
			enrollFriend: vi.fn(),
		});
	});

	it("apiServer_authenticate_validStaffKey_shouldReturnSession", async () => {
		// Arrange
		const { handleRpcRequest } = await import("./api-server.js");
		mockWhere.mockResolvedValue([{ id: "staff-1", name: "Alice", role: "staff" }]);

		// Act
		const response = handleRpcRequest(new Request("https://example.com"), {
			DB: {} as D1Database,
			API_KEY: "env-key",
			LINE_CHANNEL_ACCESS_TOKEN: "token",
			LINE_CHANNEL_SECRET: "secret",
		});
		const server = capturedServers[0];
		const session = await server.authenticate("staff-key");

		// Assert
		expect(response).toBeDefined();
		expect(session.whoami()).toEqual({ id: "staff-1", name: "Alice", role: "staff" });
	});

	it("apiServer_authenticate_envApiKey_shouldReturnOwnerSession", async () => {
		// Arrange
		const { handleRpcRequest } = await import("./api-server.js");
		mockWhere.mockResolvedValue([]);

		// Act
		handleRpcRequest(new Request("https://example.com"), {
			DB: {} as D1Database,
			API_KEY: "env-key",
			LINE_CHANNEL_ACCESS_TOKEN: "token",
			LINE_CHANNEL_SECRET: "secret",
		});
		const server = capturedServers[0];
		const session = await server.authenticate("env-key");

		// Assert
		expect(session.whoami()).toEqual({ id: "env-owner", name: "Owner", role: "owner" });
	});

	it("apiServer_authenticate_invalidKey_shouldThrow", async () => {
		// Arrange
		const { handleRpcRequest } = await import("./api-server.js");
		mockWhere.mockResolvedValue([]);

		// Act
		handleRpcRequest(new Request("https://example.com"), {
			DB: {} as D1Database,
			API_KEY: "env-key",
			LINE_CHANNEL_ACCESS_TOKEN: "token",
			LINE_CHANNEL_SECRET: "secret",
		});
		const server = capturedServers[0];

		// Assert
		await expect(server.authenticate("invalid-key")).rejects.toThrow("Invalid API key");
	});

	it("session_whoami_shouldReturnStaffContext", async () => {
		// Arrange
		const { handleRpcRequest } = await import("./api-server.js");
		mockWhere.mockResolvedValue([{ id: "staff-1", name: "Alice", role: "staff" }]);

		// Act
		handleRpcRequest(new Request("https://example.com"), {
			DB: {} as D1Database,
			API_KEY: "env-key",
			LINE_CHANNEL_ACCESS_TOKEN: "token",
			LINE_CHANNEL_SECRET: "secret",
		});
		const server = capturedServers[0];
		const session = await server.authenticate("staff-key");

		// Assert
		expect(session.whoami()).toEqual({ id: "staff-1", name: "Alice", role: "staff" });
	});

	it("session_friends_shouldReturnFriendsRpc", async () => {
		// Arrange
		const { handleRpcRequest } = await import("./api-server.js");
		mockWhere.mockResolvedValue([{ id: "staff-1", name: "Alice", role: "staff" }]);

		// Act
		handleRpcRequest(new Request("https://example.com"), {
			DB: {} as D1Database,
			API_KEY: "env-key",
			LINE_CHANNEL_ACCESS_TOKEN: "token",
			LINE_CHANNEL_SECRET: "secret",
		});
		const server = capturedServers[0];
		const session = await server.authenticate("staff-key");

		// Assert
		expect(session.friends()).toBeDefined();
		expect(createFriendQueriesMock).toHaveBeenCalled();
		expect(createFriendCommandsMock).toHaveBeenCalled();
	});

	it("session_scenarios_shouldReturnScenariosRpc", async () => {
		// Arrange
		const { handleRpcRequest } = await import("./api-server.js");
		mockWhere.mockResolvedValue([{ id: "staff-1", name: "Alice", role: "staff" }]);

		// Act
		handleRpcRequest(new Request("https://example.com"), {
			DB: {} as D1Database,
			API_KEY: "env-key",
			LINE_CHANNEL_ACCESS_TOKEN: "token",
			LINE_CHANNEL_SECRET: "secret",
		});
		const server = capturedServers[0];
		const session = await server.authenticate("staff-key");

		// Assert
		expect(session.scenarios()).toBeDefined();
		expect(createScenarioQueriesMock).toHaveBeenCalled();
		expect(createScenarioCommandsMock).toHaveBeenCalled();
	});
});
