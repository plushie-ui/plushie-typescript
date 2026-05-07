# Triage

How proposed work gets evaluated against the stewardship docs.

Sources of proposed work are many: design proposals, refactor
ideas, library upgrades, feature requests, breaking-change calls,
"while I was in there" cleanups, cross-SDK divergence flags,
observations from review passes. The flow below applies regardless
of source. The underlying docs (`posture.md`, `goals-and-non-goals.md`,
`trust-model.md`, `resilience.md`, `performance-bar.md`,
`test-discipline.md`, `simplicity.md`, `elm-invariants.md`,
`dsl-discipline.md`, `concurrency-shape.md`) are the authority on
each axis; this file is a consolidated routing tool.

## Outcomes

For any proposed work, one of:

- **Do.** Aligned with a stated goal, addresses a real bug, or is
  plain maintenance hygiene that does not warrant a stewardship-
  level question.
- **Defer to a roadmap item.** Real concern tied to a considered
  direction not currently scheduled. Append to the relevant
  `roadmap/<item>.md` "Observations" section as context for when
  the work is taken up.
- **Decline.** Misframed against the trust model, defends against
  speculative futures or impossible states, asks for work without
  the evidence the relevant doc requires, or otherwise lands on a
  stated non-goal.
- **Route to cross-SDK parity.** Concerns parity drift or an SDK
  API shape that affects parity. Goes through the
  `plushie-sdk-parity` workflow rather than being decided here.

## Routing flow

For a piece of proposed work, run these in order. First match
wins.

1. **Cross-SDK shape.** Does the work alter or surface drift in
   an API shape, behavior name, parameter ordering, event field
   shape, or wire form across multiple SDKs? Route to the parity
   workflow. plushie-elixir is the shape tiebreaker; see
   `posture.md`.

2. **Elm invariants.** Does the work touch the
   `init`/`update`/`view` contract, the return-shape validation,
   command shape, subscription diffing, widget event flow, or
   scoped IDs? Treat as a deliberate decision; default to no
   unless the change is genuinely a fix to the contract. The
   contract is the cross-SDK story; see `elm-invariants.md`.

3. **Trust-model misframe.** Does the proposal assume a threat
   model the project does not currently make a claim against
   (host as adversary under an unclaimed boundary, browser-grade
   isolation of arbitrary remote hosts treated as a hardened
   boundary, wire-as-its-own-crypto)? Decline; reference
   `trust-model.md`.

4. **Renderer-to-host integrity.** Does the work touch the
   decoder in a way that loosens the closed-shape contract
   (passing through unknown event variants, opaque-blob delivery
   to user code, spoofable response correlation, an unsafe
   parser, a `new Function` path on incoming data)? Treat as a
   deliberate decision, not a routine refactor; default to no.

5. **Resilience axis.** Does the work address a real
   things-go-wrong path that fails ungracefully (an unhandled
   rejection that crashes the runtime, a missed revert on view
   error, a stale effect tag, a transport that hangs instead of
   closing), or inconsistency between resilience patterns the
   codebase already uses? Do; reference `resilience.md`.
   Conversely, does the proposal add defensive layers for
   conditions that cannot occur given the surrounding invariants?
   Decline.

6. **Wire codec correctness.** Encode/decode symmetry, round-trip
   through MessagePack and JSONL, field-name drift between
   encoder and renderer. Do; stated goal.

7. **Lightweight by default.** Does the work consolidate
   redundant work, choose a data structure better suited to the
   realistic profile, remove clearly unnecessary per-call cost
   (extra Map lookups, redundant JSON serialization, repeated
   property access where a destructure would do), while preserving
   or improving readability? Do; reference `performance-bar.md`.
   Conversely, is the work clever-for-speed at the cost of intent,
   or a big-O claim without realistic N? Decline absent
   measurement.

8. **Test discipline.** Does the work move tests off the
   integration spine (mocking the renderer, replacing real
   binary tests with TypeScript stubs, peeking at runtime
   internals)? Decline; reference `test-discipline.md`. Does it
   move tests onto the spine (rewriting a stub test to run
   through the binary)? Do.

9. **DSL extension.** Does the proposal add a new builder shape,
   a new JSX component prop variant, a new conditional or
   template-literal type form, a new prop coercion rule? Run the
   criteria in `dsl-discipline.md` (two real users, real bug
   class, generated `.d.ts` reads cleanly, error messages point
   at the user's call site). If it does not pass, decline or
   defer.

10. **Concurrency-shape change.** Does the work introduce a new
    long-lived async resource, change the Runtime/Transport
    split, add Worker Threads, add a reactive-streams dependency,
    or move work between Runtime and Transport? Treat as a
    stewardship-level question; reference `concurrency-shape.md`.

11. **Simplicity axis.** Single-user abstraction extracted as an
    interface or class? Module split without a forcing function?
    Premature generic where specific would do? Clever conditional
    type where a flat union would do? Decline; reference
    `simplicity.md`. Conversely, three-similar-lines that have
    grown into a real concept and want to be abstracted? Do.

12. **Stated non-goal.** Backwards compatibility before 1.0, API
    stability hardening as standalone work, coverage milestones,
    refactoring without a forcing function, multi-runtime
    support without a maintainer, defending against a
    speculative deployment shape. Decline; reference
    `goals-and-non-goals.md`.

## Default behavior

If nothing matches and the work is plain maintenance (advisories,
portability bugs, broken examples, dead code, typo-class
corrections, obvious self-consistency restorations), the default
is to do it without a stewardship category. The flow earns its
keep on the harder cases: declining speculative defenses,
deferring to roadmap items, recognizing trust-model misframes,
distinguishing real algorithmic consolidation from speculative
micro-optimization, distinguishing real DSL extensions from
costume abstractions.

## When the docs need updating

If the proposed work feels stewardship-level (a real direction
question, a new constraint, a posture the docs have not yet
taken) but does not match any axis above, that is a signal the
docs are missing a category. Surface the question to the
maintainer rather than improvising a category, and update the
docs once the direction is settled.

The docs decay when every novel question gets shoehorned into
the closest existing axis. They stay useful by being explicit
about what they cover and acknowledging when they do not cover
something.
