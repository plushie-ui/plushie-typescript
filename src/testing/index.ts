// Layer 4: Testing
//
// All testing goes through the real plushie binary. No TypeScript-side
// mocks or stubs. The binary in --mock mode is sub-millisecond per
// interaction and supports multiplexed sessions for parallel tests.
//
// Modules:
//   session.ts -- test session (runtime connected to pooled transport)
//   helpers.ts -- click, find, assertText, model, tree, etc.
//   pool.ts    -- session pool lifecycle (start/stop shared binary)
//
// Public API:
//   testWith(appDef)     -- vitest fixture factory
//   createSession(appDef) -- manual session creation

export { }
