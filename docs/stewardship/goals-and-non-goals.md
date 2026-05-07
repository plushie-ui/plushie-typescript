# Goals and non-goals

The objectives plushie-typescript optimizes for, and the explicit
non-objectives it declines work against. The lists are deliberately
short; they earn their place by being recurring decision criteria,
not by enumerating every aspiration.

## Goals

Testable shipping criteria. Findings that improve any of these are
real work.

- **Wire protocol fidelity on the host side.** Messages encode and
  decode identically against every other SDK and the renderer; the
  codec stays in lockstep with the renderer's spec (authority lives
  in plushie-rust); values round-trip through MessagePack and JSONL
  without coercion drift.
- **Cross-SDK concept parity.** Concepts (event shapes, widget
  props, command structures, subscription types) converge with the
  other host SDKs at the semantic level. plushie-elixir is the
  shape tiebreaker; see `posture.md`.
- **Elm-architecture purity.** `init/update/view` is the user's
  contract. Return shapes are validated; commands are pure data;
  effects push to the edges; `view` is a pure function of model.
  The runtime preserves these invariants. See `elm-invariants.md`.
- **TypeScript-native ergonomics within the contract.** JSX
  components and builder functions both produce the same wire-bound
  tree; inline handlers on JSX/builder props are a TypeScript
  extension that compose with the pure-Elm fallback `update`.
  Discriminated unions for events; `DeepReadonly<M>` on the model
  parameter; type guards for narrowing.
- **Lightweight runtime.** Idle apps do no measurable work. No
  polling, no per-frame walking when nothing changed, no spinning
  subscription threads. High-frequency events coalesce on the
  microtask queue. See `performance-bar.md`.
- **Fault tolerance across the wire.** Renderer crash is detected
  by the transport, which restarts the binary, replays settings,
  and re-syncs the tree from a fresh full snapshot. App exception
  in `init`, `update`, `view`, or a handler reverts to the last
  good state and surfaces the error. Neither side takes the other
  down. See `resilience.md`.
- **First-hour DX through error messages.** When a handler returns
  a Promise, the runtime detects it and explains
  `Command.async()`. When a widget ID contains `/`, the runtime
  explains scoped IDs. The bar is "the user can correct the call
  site without grepping the codebase," not "the runtime does not
  crash."
- **Honest typing.** `DeepReadonly<M>` on the model parameter,
  discriminated unions for events, no `any` in the public API.
  Where TypeScript inference falls short (inline JSX lambdas), the
  docs name the limitation and recommend named typed handlers
  rather than papering over it.

## Non-goals

Explicit non-objectives. Findings or proposals that push the project
toward them get declined; they are not candidates that lost a
priority contest.

- **Backwards compatibility before 1.0.** The right design wins;
  the rename happens. npm consumers expect breaking changes in
  pre-1.0 minor bumps; the CHANGELOG names them.
- **Per-TypeScript API ergonomics that diverge from cross-SDK
  shape.** See `posture.md`. "More idiomatic in TypeScript" alone
  is not sufficient; the shape question routes through the parity
  workflow.
- **API stability hardening before 1.0.** `@deprecated` JSDoc tags
  as standalone work, sealed discriminated unions audited piecemeal,
  public/internal module audits, export map lockdown. These happen
  in a single planned sweep at the 1.0 cut, not piecemeal during
  normal development.
- **Coverage targets as a metric.** Test discipline is "exercise
  real surfaces through the renderer," not "hit a percentage." See
  `test-discipline.md`.
- **Mocking the renderer for speed.** mock-mode in the real binary
  is already fast (sub-millisecond per interaction); a TypeScript
  mock is faster only at the cost of the exact bug class the
  integration spine catches.
- **Micro-optimization at the cost of readability.** Clever
  encoding, lookup, or layout schemes in hot paths need to earn
  the obscurity with measurement. Optimizations that look clean
  and do not damage readability are welcome; see
  `performance-bar.md`.
- **Refactoring without a forcing function.** Module size or file
  length alone is not a reason to refactor. The trigger is a real
  change that the existing structure cannot accommodate cleanly.
- **DSL extensions for hypothetical future widgets or hypothetical
  type-system tricks.** A new builder, a new JSX component, a new
  conditional or template-literal type form earns its place when
  at least two real users would benefit. "We might want this
  someday" is a reason not to extend the surface. See
  `dsl-discipline.md`.
- **Multi-runtime support before there is a real demand.** Bun and
  Deno are not currently supported. Adding conditional runtime
  shims to `node:*` imports is a non-goal until a maintainer
  commits to that surface. The browser case is supported through
  `WasmTransport`, not through cross-runtime polyfills.
- **Defending against speculative deployment shapes.** Untrusted
  multi-tenant runtimes, browser-as-arbitrary-host with the host
  SDK code itself untrusted, sandboxed user apps inside other
  TypeScript runtimes. None of these are current goals. Defenses
  against them are out of scope unless and until the shape is
  taken up.
