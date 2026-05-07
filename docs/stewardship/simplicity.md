# Simplicity

The bar code in plushie-typescript has to clear, and the recurring
tradeoffs about structure and abstraction that decide what earns its
place. The other stewardship docs (`performance-bar.md`,
`resilience.md`, `test-discipline.md`, `dsl-discipline.md`) each
carry a flavor of this implicitly; this doc states it directly so
questions about "should we extract this" or "is this clear enough"
have an explicit reference.

This is not a style guide. Naming, formatting, lint rules, and
language-specific idioms live in `biome.json`, `tsconfig.json`, and
the project's TypeScript strictness flags. This doc is about the
posture above those: when to add complexity, when to refuse it,
what clarity costs, and what readability buys.

## Clarity is a constraint, not an aspiration

Code in plushie-typescript has to read clearly to a TypeScript
engineer who has not been in this codebase before. "It works" is
the floor; "it can be understood without context" is the bar.

Every reader pays the cost of obscure code. The author writes it
once; many readers will read it. Small clarity wins compound across
hundreds of files; small obscurity losses compound the other way.
Same compounding argument that drives the lightweight-by-default
stance in `performance-bar.md`, applied to reader cost instead of
CPU cost.

The bar is not negotiable. Optimizations, abstractions, defensive
layers, refactors, and clever type-system tricks all have to clear
it; the readability test wins ties.

## Abstraction has to earn its place

Extracting a helper, a type, an interface, a class, a module: each
carries cost. A reader has to follow the indirection, hold the
abstraction's contract in their head, and decide whether what the
call site shows reflects what the abstraction does inside. The
benefit has to clearly outweigh that cost.

Working rules:

- **Three similar lines is better than a premature abstraction.**
  Two pieces of code that look similar today might diverge
  tomorrow; extracting them now locks them together for reasons
  that may not survive contact with future requirements.
- **By the third use of a similar pattern, the abstraction earns
  consideration.** Not commitment, consideration. The question is
  whether the three uses are the same concept or three
  coincidentally similar ones.
- **An abstraction with one user is a costume, not an
  abstraction.** Single-use indirection is overhead. An interface
  with one implementer, a generic with one instantiation, a class
  that wraps one function call.
- **"We might need this someday" is a reason not to extract.**
  Generic code written for hypothetical future users is the
  recurring source of half-built abstractions that nobody fully
  understands later. Type-level generics are especially vulnerable
  here; see `dsl-discipline.md`.
- **Generic where specific would do is harder to read.** A
  concrete type beats a parameterized one when the
  parameterization does not have at least two real uses. Same for
  conditional types: a four-line discriminated union is clearer
  than a clever `T extends ... ? ... : ...` chain that does the
  same job.

These are working positions, not absolute rules. The burden is on
the proposed abstraction to push against them.

## Local complexity over global complexity

A 200-line function that does one thing clearly is preferable to
the same logic spread across five files in pursuit of "smaller
functions." Locality is a feature: a reader can hold the whole
thing in view. Following control flow across ten indirections
costs more than reading a longer linear sequence.

Module size on its own is not a problem. A large module is not an
invitation to split unless a real change is forced to bend around
its existing shape. Refactoring without a forcing function is a
non-goal (`goals-and-non-goals.md`); this is one of the places
that rule shows up most often. The runtime is large because the
runtime does a lot; that is fine.

Files split for the sake of "smaller files" frequently end up with
cross-file dependencies that obscure the same logic the single
file made obvious. Cohesion across a file beats brevity of any one
file.

## Functional flavor

The codebase is functional-first; the Elm-architecture pattern
(`init/update/view`) is the SDK's structural backbone for a reason.
TypeScript supports both styles cleanly; the recurring choices that
follow:

- **Pure functions where possible.** Side effects push to the edges
  (Transport owns I/O, command execution wraps effectful calls,
  the rest of the runtime is functional). `update` is pure: it
  returns a new model and commands; the runtime performs the
  commands.
- **Immutable data.** `DeepReadonly<M>` on the model parameter
  makes mutation a compile-time error. Updates use spread (`{
  ...state, count: state.count + 1 }`). No Immer dependency. Users
  can bring Immer if they want; the SDK does not adopt it.
- **Discriminated unions over flag-based state machines.** Events
  use a `kind` discriminant with type guards (`isClick`,
  `isTimer`, etc.); commands use a string `type` plus a `COMMAND`
  symbol tag for reliable detection. A union of named variants
  beats a generic event map with three booleans and an unwritten
  rule about which combinations are valid.
- **Type guards for narrowing.** TypeScript's narrowing on
  discriminated unions is strong enough that the user can pattern
  match in `update` with `if (event.kind === 'widget' &&
  isClick(event))` and get the right type for the body. Runtime
  guards mirror compile-time ones.
- **Plain functions and frozen objects for runtime constructs.**
  `Command` is a frozen object with a Symbol tag. `Subscription`
  is a frozen object with a `type` discriminant. Widget builders
  are functions that return frozen `UINode`s. No classes for
  things that are pure data; no decorators; no metadata reflection
  tricks.
- **Composition over inheritance-shaped patterns.** Interfaces
  define a contract; modules implement it. The Transport interface
  is a small, well-justified abstraction with multiple real
  implementations; that is the shape that earns its place. There
  is no `extends` in the public API for inheritance reasons.

TypeScript idiom prevails on syntax (camelCase, async/await,
template literal types where appropriate). The concept-level
patterns above converge with the rest of the project ecosystem
(see `posture.md` on the cross-SDK story).

## Honest typing

The TypeScript surface is the contract; honest typing means the
surface tells the truth.

- **`DeepReadonly<M>` on the model parameter.** Mutation attempts
  are compile errors, dev-mode `deepFreeze` catches the cases that
  bypass the type system.
- **No `any` in the public API.** `unknown` for genuinely opaque
  values that the caller has to narrow; specific types
  everywhere else.
- **Discriminated unions for events and commands.** Each variant
  has its own shape; type guards narrow.
- **Where TypeScript inference falls short, name the limitation.**
  Inline JSX lambdas have a known limitation around handler type
  inference; the docs recommend named typed handlers in those
  cases rather than papering over the limitation with assertions.

A type that lies (`as` cast hiding a real coercion, an interface
wider than the runtime accepts, an `any` masking a genuine `unknown`)
is a bug-class problem, not a stylistic preference. The
maintenance cost surfaces later when a refactor exposes the
mismatch.

## Comments earn their place too

Code should explain itself. Comments answer questions the code
cannot:

- A non-obvious constraint or invariant the surrounding code
  holds.
- A surprising or subtle behavior a reader might trip on.
- A workaround for a specific external issue that the reader needs
  to understand to evaluate the code.

Comments are not for explaining what the next line does. If a
comment is needed to explain what, the code itself usually wants
to be clearer.

JSDoc on exported names is documentation, not commentary; it
shows up in TypeDoc-generated API references and in editor
hovercards. Public functions and types have JSDoc that reads as
user-facing documentation. Internal modules use sparse JSDoc and
rely on the code itself.

## Implications

- Abstractions added without justifying use are declined, even
  when technically correct.
- Refactors that fragment a coherent module into smaller files
  without a forcing function are declined.
- Half-built abstractions (extracted but only partially applied,
  or extracted with planned consumers never arriving) are
  bug-class. Either complete the application or fold the
  abstraction back into the call sites.
- Reviewer comments of the form "I had to re-read this three
  times" are first-class and earn a rewrite, regardless of whether
  the code is correct as written.
- Type-system cleverness (deeply nested conditional types,
  template-literal type tricks, recursive type wizardry) needs to
  pay for itself in catching real user bugs. A clever type that
  the user has to fight to satisfy is the wrong direction; see
  `dsl-discipline.md`.
