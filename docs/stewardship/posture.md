# Project posture

What plushie-typescript is, who it is for, and the disciplines that
keep it that way.

## What plushie-typescript is

The TypeScript host SDK for Plushie. An Elm-architecture app runtime
that drives a renderer subprocess (Rust binary, native windows via
iced) over a typed wire protocol. The SDK ships as an npm package;
user apps call `app(...)` with `init/update/view`, declare their UI
with builder functions or JSX components, and the runtime handles
diffing, command dispatch, subscriptions, and bridge lifecycle.

Primary runtime is Node.js (>=20). The same SDK runs against a WASM
build of the renderer in the browser through `WasmTransport`. SEA
(Single Executable Application) bundling is supported for shipping
self-contained binaries. Bun and Deno are not currently supported
targets; the SDK uses `node:*` imports without conditional shims.

This SDK is one of six host SDKs sharing the renderer (Elixir, Rust,
Gleam, Python, Ruby, TypeScript). The renderer binary is shared;
each SDK implements its own runtime against it.

## Audience

- App developers writing Plushie apps in TypeScript. They see the
  `app()` factory, the widget builder API, the JSX component API,
  the Command and Subscription constructors, the event guards
  (`isClick`, `isTimer`, etc.), and the test framework.
- Custom widget authors writing pure-TS composite widgets via
  `WidgetDef`/`buildWidget`, or wiring native (Rust) widgets through
  `defineNativeWidget`.
- SDK maintainers. The Transport interface, the Runtime, the wire
  codec, the test pool, the CLI tools.

The npm package's public API is what `package.json` `exports`
exposes: `plushie`, `plushie/ui`, `plushie/canvas`, `plushie/jsx-runtime`,
`plushie/jsx-dev-runtime`, `plushie/testing`, `plushie/client`. The
`.d.ts` surface for these subpaths is the contract. Anything not
re-exported from those entry points is internal regardless of file
location.

## Cross-SDK relationship

plushie-typescript is not the canonical reference SDK.

- **API shape tiebreaker is plushie-elixir.** When a concept's name,
  structure, or parameter ordering is contested across SDKs, what
  plushie-elixir does is the answer. plushie-rust is the protocol
  authority (wire format, message variants, codec); plushie-elixir
  is the shape authority (what user-facing concepts look like).
- A rename here that diverges from the cross-SDK shape is drift, not
  refactoring. "More idiomatic in TypeScript" alone is not
  sufficient justification for breaking parity.
- Cross-SDK parity is audited via the sibling `plushie-sdk-parity/`
  repo. Findings about parity drift route through that workflow
  rather than as standalone work here.
- Within-language idiom prevails on syntax. camelCase, JSX where
  natural, discriminated unions for events, frozen tagged objects
  for commands, type-driven over runtime-checked, async/await,
  AbortController. Concepts, names, parameter ordering, and
  behavior converge with the other SDKs.

The TypeScript SDK has more legitimate divergence than most: JSX is
TypeScript-native and not portable; inline handlers on JSX/builder
props are a TypeScript-natural extension that other SDKs do not
have. These are deliberate choices documented in the project layout,
not parity violations. The `update` fallback exists precisely so the
pure-Elm style is also supported and stays in shape parity.

## Stage

Pre-1.0. There is no backwards-compatibility obligation today. When
the best design requires renaming a callback, a field, or
restructuring a module, that is the right call. The CHANGELOG notes
breaking changes explicitly.

The 1.0 boundary is when stability obligations begin. Until then,
the priority is getting the shape right, not preserving the current
shape. Pre-1.0 is the time to settle questions about API shape,
naming, and structure that will be expensive to revisit.

API stability hardening (`@deprecated` JSDoc tags, sealed
discriminated unions audited for `@public`, public/internal module
audits in `.d.ts`, the export map locked down) lands in a single
planned sweep at the 1.0 cut, not piecemeal during normal
development.

## Disciplines

Recurring decision rules. Not negotiable on a per-ticket basis.

- **Tests run through the real renderer.** The default test backend
  runs `plushie-renderer --mock`: real binary, real wire protocol,
  real codec, real Core engine, no GPU. A test that passes against
  a TypeScript-side mock and would fail against the binary is worse
  than no test. Stubs are reserved for failure modes the binary
  cannot exhibit. See `test-discipline.md`.
- **Cross-SDK claims are verified, not assumed.** When the question
  is "does plushie-elixir do this the same way," the answer comes
  from reading source on each side. "It looks like" is not a
  verification.
- **Design before code at boundaries.** Public npm API, the JSX
  component shape, the wire codec on the TypeScript side, the
  Transport interface, the test session contract. Internal
  refactors can iterate fast; boundary changes pay the design tax
  up front.
- **Clarity is the bar.** Code reads clearly to someone new to the
  file; abstractions earn their place by use, not by hypothesis;
  complexity is a cost. See `simplicity.md`.
- **No half-built features.** A feature lands fully or not at all.
  Half-built features create drift in the parity surface and
  accumulate into "the docs say it does X but three SDKs do not
  actually."
- **Local cleanup, not scope creep.** Small, low-risk improvements
  to code under active modification are welcome. Larger or risky
  adjacent improvements get noted and advocated for as follow-on
  work, not silently rolled into the current change.
- **No legacy or compatibility shims.** Pre-1.0; remove dead paths
  cleanly rather than preserving old behavior.
