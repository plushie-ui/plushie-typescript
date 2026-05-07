# Test discipline

How tests are written, what they cost, and what they commit to. The
discipline below shows up in plushie-typescript's own test suite, in
widget integration tests, and in parallel form across every host
SDK. It is one of the project's load-bearing conventions.

## The integration spine

Tests exercise the real renderer. The default test backend
(`mock`) runs `plushie-renderer --mock --max-sessions N`: real
binary, real wire protocol, real codec, real Core engine. The only
thing the default backend strips is the GPU rendering step. Tests
dispatch events, read model and tree state, and assert on
observable behavior through the same API user apps use.

A test that passes against a TypeScript-side mock and would fail
against the binary is worse than no test. It gives confidence on
the exact class of bugs the integration is meant to catch: wire
format drift between encoder and renderer, startup handshake
ordering, codec edge cases, lifecycle on transport restart, the
small protocol-level details that pure-language mocks have no
mechanism to diverge on.

This is not about coverage as a metric. It is about catching the
bugs that matter where they actually live, which is at boundaries.

## Three test modes

The renderer offers three runtime modes; the test backends follow
them by name. The naming is a cross-SDK contract.

- **mock**: microseconds to milliseconds per interaction.
  Protocol-only. Real binary, real wire, real Core, no rendering.
  The default for most tests; fast enough that a full suite runs
  through the binary without flinching. `pnpm test` uses this.
- **headless**: tens to low hundreds of milliseconds per
  interaction. Real rendering via tiny-skia, no display server.
  Used when the test cares about pixels: screenshot golden files
  (`session.assertScreenshot`), tree-hash assertions
  (`session.assertTreeHash`), layout-affecting bugs.
  `PLUSHIE_TEST_BACKEND=headless pnpm test`.
- **windowed**: seconds per interaction. Full iced rendering with
  a real display (headless weston on Linux, native display
  elsewhere; Xvfb works for X11-only environments). Used when the
  test cares about full window lifecycle, focus events,
  or platform-specific behavior.

The names mean the same thing in plushie-rust, plushie-elixir,
plushie-gleam, plushie-python, plushie-ruby. Findings about naming
or behavior drift between the three modes route through the parity
workflow.

## Pooled mock backend

`SessionPool` in `src/client/pool.ts` starts a single
`plushie-renderer --mock --max-sessions N` process and multiplexes
tests over it. Each test gets isolated state via session IDs in
every wire message. The pool starts in vitest's setup
(`afterAll(stopPool)` in `test/setup.ts` for cleanup) and is
amortized across the suite rather than paid per test. Windowed
mode does not pool: each test gets its own renderer.

Tests use `testWith(appConfig)` from `plushie/testing`, which sets
up a session, gives the test a `TestSession` to talk to, and tears
down at the end of the test. The DSL (`click`, `typeText`, `find`,
`model`, `tree`, `assertText`, `assertExists`) runs through the
session and exercises the real wire path.

## Synchronous test API

Tests synchronize with the runtime through the public test session
API:

- `session.click(id)` and friends drive an Interact message and
  await the round-trip.
- `session.model()` reads the current model from the runtime.
- `session.tree()` reads the rendered tree.
- `session.awaitAsync(tag)` waits for an async command result.

There is no peeking at the runtime's internal state. Tests
exercise the same API user apps use and the same surface that
production callers rely on for synchronization. A test that needs
to peek at internal state to assert is usually a sign that the
public API is missing a query, not a sign that the test framework
needs an escape hatch.

## When stubs are acceptable

A TypeScript stub that does not go through the renderer is
acceptable only for failure modes the binary cannot exhibit
cleanly:

- Forced renderer crash simulation (the binary cannot be told
  "panic now" via the protocol).
- Malformed wire bytes the codec rejects before any typed delivery
  path runs.
- Direct calls to `update` or a handler to test pure return-shape
  behavior where no runtime context is needed.
- Test infrastructure that wraps the integration primitives
  themselves.

If a test can run against the binary, it does. The bar for adding
a non-binary stub is "what failure mode does this expose that
nothing else can," answered concretely.

## Tests as documentation

Tests should read as a story for the next person who opens the
file. A clear setup, an explicit action, an assertion that names
what is being verified. Behavior-driven shape: the test framework
is incidental; what is being verified should be obvious from the
test name and the body.

Use vitest's `describe` blocks for organization. The describe
string serves as a section header; comment-based section headers
are noise.

The corollary: tests are not allowed to be slow. If a test is
slow, the underlying code path is usually slow in production too.
Speed up the code; do not accept the slow test. mock-mode exists
to skip the GPU step, not to hide a slow code path behind a faster
harness.

## Failing test before fix

For a bug fix, write the failing test first when possible. A test
added alongside the fix that would have passed without the fix
proves nothing about the bug. The failing test is the definition
of done.

Exceptions: refactors with no behavior change (the existing suite
is the regression net), and new features where the test and the
implementation arrive together.

## Binary requirement

Tests need the binary. It must be available before `pnpm test`
works. The postinstall script handles the typical case;
`PLUSHIE_RUST_SOURCE_PATH` plus `pnpm preflight` rebuilds from a
sibling checkout. If the binary is missing, tests fail fast with
a clear error message and resolution instructions.

Setting `PLUSHIE_RUST_SOURCE_PATH` to a plushie-rust checkout
makes preflight rebuild the renderer first via `cargo build
--release -p plushie-renderer`. A stale binary hides real bugs and
surfaces phantom ones; the rebuild step is load-bearing whenever
the renderer side is under active change.

## Implications

- A feature has to be testable through the renderer. If a feature
  cannot be exercised through the integration spine, that is a
  design problem with the feature, not a problem with the test
  discipline.
- "Let's mock the renderer for speed" proposals are declined.
  Speed comes from mock-mode in the real binary, which is already
  fast; the cost of a TypeScript mock is the bug class it hides.
- Coverage as a percentage is a non-goal (see
  `goals-and-non-goals.md`). Coverage of real surfaces is what
  matters; the integration spine is what produces it.
- Tests that peek at runtime internals or rely on undocumented
  internals are brittle and get rewritten to use the public test
  session API.
