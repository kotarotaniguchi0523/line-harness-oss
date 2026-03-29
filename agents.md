# Agent Definitions for Claude Code

## Agent: schema-architect
**Role**: Database schema design and Drizzle ORM migrations
**Context**: packages/db/src/schema/, packages/db/migrations/, drizzle.config.ts
**Instructions**:
- When creating tables, always use the common column helpers from _common.ts
- Ensure every table has id, created_at, updated_at
- Add deleted_at for entities that need soft delete
- Add created_by/updated_by for audit trail
- Define Drizzle relations for every foreign key
- Add composite indexes for common query patterns
- Generate migration with `pnpm db:generate` after schema changes
- Validate migration SQL is idempotent (IF NOT EXISTS)

## Agent: domain-modeler
**Role**: DDD domain layer implementation
**Context**: packages/domain/src/
**Instructions**:
- Aggregates are pure classes with no I/O dependencies
- Use Result<T, E> for operations that can fail (not exceptions)
- Value objects are immutable and validated at construction
- Domain events are plain objects with type discriminant
- Services coordinate multiple aggregates via repository ports
- Never import from packages/db directly (use port interfaces)

## Agent: rpc-builder
**Role**: Cap'n Web RPC server and client integration
**Context**: apps/worker/src/rpc/, apps/web/src/lib/rpc.ts
**Instructions**:
- Server-side RpcTarget classes extend capnweb's RpcTarget
- Authentication via authenticate() method returning AuthenticatedSession capability
- Each domain gets its own RpcTarget class (FriendsRpc, ScenariosRpc, etc.)
- Use Zod schemas from packages/contracts for input validation
- Leverage promise pipelining for batch operations
- Non-RPC routes (webhook, LIFF, short links) stay as standard Hono routes

## Agent: frontend-builder
**Role**: TanStack Start routes and components
**Context**: apps/web/src/
**Instructions**:
- Route components should be under 80 lines
- Extract data fetching to hooks/ using TanStack Query
- Extract complex UI to components/domain/
- Never use useState for data that comes from the server
- Use TanStack Form + Zod for all forms
- Every route should have an errorComponent
- Use Panda CSS with design tokens from @line-crm/design-tokens
- Use the account store for selected LINE account context

## Agent: worker-developer
**Role**: Hono worker routes, middleware, services
**Context**: apps/worker/src/
**Instructions**:
- Use t3-env for all environment variable access
- Auth middleware validates session cookie or Bearer token
- Domain services in services/ orchestrate business logic
- LINE API calls use packages/line-api (never raw fetch to LINE)
- Event bus fires domain events; automation engine consumes them
- Cron handler processes step deliveries, broadcasts, reminders

## Agent: test-writer
**Role**: Test creation for all layers
**Context**: **/*.test.ts, vitest.config.ts
**Instructions**:
- Domain tests: pure unit tests, no mocking needed (aggregates are pure)
- Repository tests: use miniflare D1 fixture
- RPC tests: use capnweb test utilities
- Frontend tests: use @testing-library/react with msw for API mocking
- E2E tests: Playwright against local dev server
- Follow AAA pattern (Arrange, Act, Assert)
- Test file co-located with source: foo.ts -> foo.test.ts
