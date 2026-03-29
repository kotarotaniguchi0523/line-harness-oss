import { describe, expect, it } from "vitest";
import type { Result } from "./result.js";
import {
	type DomainError,
	domainError,
	ErrorCodes,
	ErrorMessages,
	err,
	fromPromise,
	fromThrowable,
	ok,
} from "./result.js";

describe("neverthrow Result re-exports", () => {
	it("ok_shouldCreateSuccessResult", () => {
		const result = ok("value");

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe("value");
	});

	it("err_shouldCreateFailureResult", () => {
		const result = err("failure");

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toBe("failure");
	});

	it("ok_map_shouldTransformValue", () => {
		const result = ok(2);

		const mapped = result.map((value) => value * 3);

		expect(mapped.isOk()).toBe(true);
		expect(mapped._unsafeUnwrap()).toBe(6);
	});

	it("err_map_shouldPassThrough", () => {
		const result: Result<number, string> = err("failure");

		const mapped = result.map((value) => value * 3);

		expect(mapped.isErr()).toBe(true);
		expect(mapped._unsafeUnwrapErr()).toBe("failure");
	});

	it("ok_andThen_shouldChain", () => {
		const result = ok(2);

		const chained = result.andThen((value) => ok(value * 4));

		expect(chained.isOk()).toBe(true);
		expect(chained._unsafeUnwrap()).toBe(8);
	});

	it("ok_unsafeUnwrap_shouldReturnValue", () => {
		const result = ok("value");

		const value = result._unsafeUnwrap();

		expect(value).toBe("value");
	});

	it("err_unsafeUnwrap_shouldThrow", () => {
		const result = err(new Error("failure"));

		const unwrap = () => result._unsafeUnwrap();

		expect(unwrap).toThrow();
	});

	it("fromThrowable_success_shouldReturnOk", () => {
		const safeFn = fromThrowable(
			() => "value",
			(e) => (e instanceof Error ? e : new Error(String(e))),
		);

		const result = safeFn();

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe("value");
	});

	it("fromThrowable_failure_shouldReturnErr", () => {
		const safeFn = fromThrowable(
			() => {
				throw new Error("failure");
			},
			(e) => (e instanceof Error ? e : new Error(String(e))),
		);

		const result = safeFn();

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toBe("failure");
	});

	it("fromPromise_success_shouldReturnOk", async () => {
		const result = await fromPromise(Promise.resolve("async-value"), (e) =>
			e instanceof Error ? e : new Error(String(e)),
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe("async-value");
	});

	it("fromPromise_failure_shouldReturnErr", async () => {
		const result = await fromPromise(Promise.reject(new Error("async-failure")), (e) =>
			e instanceof Error ? e : new Error(String(e)),
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toBe("async-failure");
	});

	it("ok_match_shouldCallOkBranch", () => {
		const result = ok(42);

		const output = result.match(
			(val) => `success: ${val}`,
			(error) => `error: ${error}`,
		);

		expect(output).toBe("success: 42");
	});

	it("err_match_shouldCallErrBranch", () => {
		const result: Result<number, string> = err("boom");

		const output = result.match(
			(val) => `success: ${val}`,
			(error) => `error: ${error}`,
		);

		expect(output).toBe("error: boom");
	});
});

describe("DomainError helpers", () => {
	it("domainError_shouldCreateFrozenErrorObject", () => {
		const error = domainError(ErrorCodes.NOT_FOUND, "entity missing", { id: "abc" });

		expect(error.code).toBe(ErrorCodes.NOT_FOUND);
		expect(error.message).toBe("entity missing");
		expect(error.context).toEqual({ id: "abc" });
		expect(Object.isFrozen(error)).toBe(true);
	});

	it("domainError_withoutContext_shouldOmitContextKey", () => {
		const error = domainError(ErrorCodes.VALIDATION_FAILED, "bad input");

		expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
		expect(error.message).toBe("bad input");
		expect(error).not.toHaveProperty("context");
	});

	it("ErrorCodes_shouldExposeAllExpectedCodes", () => {
		expect(ErrorCodes.NOT_FOUND).toBe("NOT_FOUND");
		expect(ErrorCodes.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
		expect(ErrorCodes.ALREADY_EXISTS).toBe("ALREADY_EXISTS");
		expect(ErrorCodes.UNAUTHORIZED).toBe("UNAUTHORIZED");
		expect(ErrorCodes.FORBIDDEN).toBe("FORBIDDEN");
		expect(ErrorCodes.INVARIANT_VIOLATED).toBe("INVARIANT_VIOLATED");
		expect(ErrorCodes.INVALID_STATE_TRANSITION).toBe("INVALID_STATE_TRANSITION");
		expect(ErrorCodes.NOT_ASSIGNED).toBe("NOT_ASSIGNED");
		expect(ErrorCodes.DUPLICATE_ORDER).toBe("DUPLICATE_ORDER");
		expect(ErrorCodes.STEP_NOT_FOUND).toBe("STEP_NOT_FOUND");
	});

	it("ErrorMessages_shouldExposeAllExpectedMessages", () => {
		expect(ErrorMessages.TAG_NOT_ASSIGNED).toBeDefined();
		expect(ErrorMessages.STEP_ORDER_ALREADY_EXISTS).toBeDefined();
		expect(ErrorMessages.STEP_ORDER_NOT_FOUND).toBeDefined();
		expect(ErrorMessages.CANNOT_SCHEDULE_BROADCAST).toBeDefined();
		expect(ErrorMessages.CANNOT_SEND_BROADCAST).toBeDefined();
	});

	it("domainError_insideErrResult_shouldBeExtractable", () => {
		const result: Result<void, DomainError> = err(
			domainError(ErrorCodes.INVARIANT_VIOLATED, "broken rule", { field: "x" }),
		);

		expect(result.isErr()).toBe(true);
		const error = result._unsafeUnwrapErr();
		expect(error.code).toBe(ErrorCodes.INVARIANT_VIOLATED);
		expect(error.message).toBe("broken rule");
		expect(error.context).toEqual({ field: "x" });
	});
});
