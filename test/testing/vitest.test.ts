import { describe, expect, test, vi } from "vitest";
import { app } from "../../src/app.js";
import { testWith } from "../../src/testing/index.js";
import type { TestSession } from "../../src/testing/session.js";
import { createTestWithApi } from "../../src/testing/vitest.js";

type FakeTestApi = ((...args: unknown[]) => void) & Record<PropertyKey, unknown>;

interface Registration {
  readonly path: readonly string[];
  readonly args: readonly unknown[];
}

const chainableKeys = ["concurrent", "fails", "only", "sequential", "skip", "todo"] as const;

function createFakeTestApi(
  registrations: Registration[],
  path: readonly string[] = [],
): FakeTestApi {
  const api = ((...args: unknown[]) => {
    registrations.push({ path, args });
  }) as FakeTestApi;

  for (const key of chainableKeys) {
    Object.defineProperty(api, key, {
      get() {
        return createFakeTestApi(registrations, [...path, key]);
      },
    });
  }

  api["skipIf"] = function skipIf(this: FakeTestApi, condition: unknown) {
    if (this !== api) throw new Error("skipIf called without the original test API");
    return condition ? this["skip"] : this;
  };
  api["runIf"] = function runIf(this: FakeTestApi, condition: unknown) {
    if (this !== api) throw new Error("runIf called without the original test API");
    return condition ? this : this["skip"];
  };

  return api;
}

function createSessionDouble(
  stopAndWait = vi.fn().mockResolvedValue(undefined),
): TestSession<unknown> {
  return { stopAndWait } as unknown as TestSession<unknown>;
}

describe("createTestWithApi", () => {
  test("real Vitest exposes accessor modifiers and this-dependent conditionals", () => {
    const skip = Object.getOwnPropertyDescriptor(test, "skip");
    const only = Object.getOwnPropertyDescriptor(test, "only");
    const skipIf = Object.getOwnPropertyDescriptor(test, "skipIf");
    const runIf = Object.getOwnPropertyDescriptor(test, "runIf");

    expect(skip?.get).toEqual(expect.any(Function));
    expect(only?.get).toEqual(expect.any(Function));
    expect(skipIf?.value).toEqual(expect.any(Function));
    expect(runIf?.value).toEqual(expect.any(Function));
    expect(() => skipIf?.value.call(undefined, true)).toThrow();
    expect(() => runIf?.value.call(undefined, false)).toThrow();
    expect(skipIf?.value.call(test, true)).toEqual(expect.any(Function));
    expect(runIf?.value.call(test, false)).toEqual(expect.any(Function));
  });

  test("testWith resolves Vitest without importing it at module load", () => {
    const testApi = testWith(
      app({
        init: {},
        view: () => null,
        update: (state) => state,
      }),
    );

    expect(typeof testApi).toBe("function");
    expect(Object.getOwnPropertyDescriptor(testApi, "skip")?.get).toEqual(expect.any(Function));
  });

  test("passes Vitest options through and merges injected context with the session", async () => {
    const registrations: Registration[] = [];
    const api = createFakeTestApi(registrations);
    const session = createSessionDouble();
    const createSession = vi.fn().mockResolvedValue(session);
    const fn = vi.fn();
    const plushieTest = createTestWithApi(api, createSession) as any;
    const options = { retry: 1, injectProperties: true };

    (plushieTest as unknown as (...args: unknown[]) => void)("uses fixtures", options, fn);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.args[0]).toBe("uses fixtures");
    expect(registrations[0]?.args[1]).toBe(options);

    const wrappedFn = registrations[0]?.args[2] as (ctx: Record<string, unknown>) => Promise<void>;
    await wrappedFn({ injected: "value", session: "from-vitest" });

    expect(createSession).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({ injected: "value", session });
    expect(session.stopAndWait).toHaveBeenCalledOnce();
  });

  test("forwards skip and only modifiers to the underlying test API", async () => {
    const registrations: Registration[] = [];
    const api = createFakeTestApi(registrations);
    const session = createSessionDouble();
    const createSession = vi.fn().mockResolvedValue(session);
    const plushieTest = createTestWithApi(api, createSession) as any;
    const fn = vi.fn();

    plushieTest.skip("skipped", fn);
    plushieTest.concurrent.only("focused", fn, 250);

    expect(registrations.map((registration) => registration.path)).toEqual([
      ["skip"],
      ["concurrent", "only"],
    ]);
    expect(registrations[1]?.args[2]).toBe(250);

    const skippedFn = registrations[0]?.args[1] as (ctx: Record<string, unknown>) => Promise<void>;
    const focusedFn = registrations[1]?.args[1] as (ctx: Record<string, unknown>) => Promise<void>;

    await skippedFn({});
    await focusedFn({});

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, { session });
    expect(fn).toHaveBeenNthCalledWith(2, { session });
  });

  test("wraps conditional Vitest APIs that return nested test functions", async () => {
    const registrations: Registration[] = [];
    const api = createFakeTestApi(registrations);
    const session = createSessionDouble();
    const createSession = vi.fn().mockResolvedValue(session);
    const plushieTest = createTestWithApi(api, createSession) as any;
    const fn = vi.fn();

    plushieTest.skipIf(false)("runs", fn);
    plushieTest.skipIf(true)("skips", fn);
    plushieTest.runIf(false)("does not run", fn);

    expect(registrations.map((registration) => registration.path)).toEqual([
      [],
      ["skip"],
      ["skip"],
    ]);

    const wrappedFn = registrations[0]?.args[1] as (ctx: Record<string, unknown>) => Promise<void>;
    await wrappedFn({});

    expect(createSession).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({ session });
  });

  test("preserves both test and cleanup errors", async () => {
    const registrations: Registration[] = [];
    const api = createFakeTestApi(registrations);
    const testError = new Error("test failed");
    const cleanupError = new Error("cleanup failed");
    const session = createSessionDouble(
      vi.fn(async () => {
        throw cleanupError;
      }),
    );
    const plushieTest = createTestWithApi(api, vi.fn().mockResolvedValue(session)) as any;

    plushieTest("fails", () => {
      throw testError;
    });

    const wrappedFn = registrations[0]?.args[1] as (ctx: Record<string, unknown>) => Promise<void>;

    try {
      await wrappedFn({});
      throw new Error("expected wrapped test to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual([testError, cleanupError]);
    }
  });
});
