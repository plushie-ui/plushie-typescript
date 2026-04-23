/**
 * Layer 4: Testing framework.
 *
 * All testing goes through the real plushie binary in mock mode.
 * No TypeScript-side mocks or stubs. The binary is fast enough
 * (sub-millisecond per interaction in mock mode) and provides
 * session isolation via multiplexing.
 *
 * ## Quick start
 *
 * ```ts
 * import { testWith } from 'plushie/testing'
 * import { app } from 'plushie'
 *
 * const myApp = app({ init: { count: 0 }, view: (s) => ... })
 * const test = testWith(myApp)
 *
 * test('increments', async ({ session }) => {
 *   await session.click('increment')
 *   expect(session.model().count).toBe(1)
 * })
 * ```
 *
 * @module
 */

import type { AppDefinition } from "../app.js";
import { resolveBinary } from "../client/binary.js";
import { SessionPool } from "../client/pool.js";
import type { WireFormat } from "../client/transport.js";
import { TestSession } from "./session.js";

export type { WireNode } from "../tree/normalize.js";
export type { Element, TestSession } from "./session.js";

/** Options for creating test sessions. */
export interface TestOptions {
  /** Path to the plushie binary. Resolved automatically if omitted. */
  binary?: string;
  /** Renderer mode. Defaults to "mock". */
  mode?: "mock" | "headless";
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat;
  /** Maximum concurrent sessions. Defaults to 8. */
  maxSessions?: number;
}

// -- Singleton pool -------------------------------------------------------

let globalPool: SessionPool | null = null;
let poolOptions: TestOptions = {};

/**
 * Get or create the global session pool.
 * The pool is shared across all test sessions.
 */
function getPool(opts: TestOptions = {}): SessionPool {
  if (!globalPool) {
    const binary = opts.binary ?? resolveBinary();
    globalPool = new SessionPool({
      binary,
      mode: opts.mode ?? "mock",
      format: opts.format ?? "msgpack",
      maxSessions: opts.maxSessions ?? 8,
    });
    globalPool.start();
    poolOptions = opts;
  }
  return globalPool;
}

/** Stop the global pool. Call in afterAll or globalTeardown. */
export function stopPool(): void {
  if (globalPool) {
    globalPool.stop();
    globalPool = null;
  }
}

/**
 * Create a test session for a plushie app.
 *
 * The session is backed by the real plushie binary in the configured test mode.
 * Call `session.stop()` when done (or use `testWith` for automatic lifecycle).
 *
 * @param appDef - The app definition created by `app()`.
 * @param opts - Test options.
 * @returns A started TestSession ready for interactions.
 */
export async function createSession<M>(
  appDef: AppDefinition<M>,
  opts?: TestOptions,
): Promise<TestSession<M>> {
  const pool = getPool(opts);
  const sessionId = pool.register();
  const format = opts?.format ?? poolOptions.format ?? "msgpack";
  const mode = pool.mode();
  const session = new TestSession(appDef.config, pool, sessionId, format, mode);
  await session.start();
  return session;
}

/**
 * Create a vitest test fixture for a plushie app.
 *
 * Returns a `test` function that automatically creates and destroys
 * a fresh test session for each test.
 *
 * ```ts
 * const test = testWith(myApp)
 *
 * test('works', async ({ session }) => {
 *   await session.click('button')
 *   expect(session.model().count).toBe(1)
 * })
 * ```
 *
 * @param appDef - The app definition created by `app()`.
 * @param opts - Test options.
 * @returns A vitest-compatible test function with a `session` fixture.
 */
export function testWith<M>(appDef: AppDefinition<M>, opts?: TestOptions) {
  // Dynamic import to avoid hard dependency on vitest
  // Users who call testWith are already in a vitest context
  return async function testRunner(
    _name: string,
    fn: (ctx: { session: TestSession<M> }) => Promise<void>,
  ): Promise<void> {
    const session = await createSession(appDef, opts);
    try {
      await fn({ session });
    } finally {
      session.stop();
    }
  };
}
