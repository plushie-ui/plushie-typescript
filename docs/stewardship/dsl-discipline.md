# DSL discipline

plushie-typescript does not have macros. The "DSL" in this SDK is
the type-driven builder API and the JSX component layer. The same
forces that make a macro DSL prone to drift apply here, just
expressed through the type system instead of compile-time codegen:
new conditional types, new generic forms, new template-literal
tricks, and the readability of `.d.ts` output. This doc describes
when a new piece of that surface earns its place.

## What the DSL is

A user gets the widget vocabulary three ways, all producing the
same `UINode` tree:

- **Builder functions** from `plushie/ui` (camelCase): `column`,
  `text`, `button`, `textInput`, etc. Each takes an id, options
  with TypeScript-typed props, and children. Plain function calls.
- **JSX components** from `plushie/ui` (PascalCase): `<Window>`,
  `<Column>`, `<Text>`, `<Button>`. The `plushie/jsx-runtime` and
  `plushie/jsx-dev-runtime` exports make these usable with the
  TypeScript automatic JSX transform.
- **Canvas primitives** from `plushie/canvas`: shape builders,
  path commands, gradient and stroke descriptors, transforms, and
  interactive wrappers.

The contract is uniform: every builder produces a frozen `UINode`,
every JSX component compiles to a builder call, every option is a
TypeScript-typed prop. There is no codegen, no macro expansion, no
runtime metaprogramming. Type-level work is what catches mistakes
at compile time; runtime guards mirror those checks where
type-system assumptions can be bypassed.

## When a new builder or component earns its place

The DSL is permissive about adding widgets (each new widget gets
its own builder and JSX component, deriving from the same prop
schema). It is conservative about adding new shapes of the API
itself: a new option-block shape, a new prop variant, a new
type-level form.

A new DSL form earns its place when:

- At least two existing or imminent users want the same shape.
- The form replaces a runtime construct that is harder to read or
  harder to validate at the call site.
- A meaningful class of bugs becomes detectable at compile time
  that runtime checks would catch only on first use.
- The generated `.d.ts` reads cleanly to a user reading the API
  reference (or hovering in their editor).

A new DSL form does not earn its place when:

- The argument is "we could check this with a clever conditional
  type." Type-level work has costs (compile time, error message
  legibility, hover-tooltip readability); the bug class has to be
  real and recurring.
- The argument is "this would let users write less code." If the
  current form already reads cleanly, fewer characters is not the
  bar.
- The argument is "this would be more idiomatic in TypeScript."
  See `posture.md`. Cross-SDK shape is the constraint;
  TypeScript-native ergonomics are downstream of that.

A new DSL form is rejected when:

- It hides indirection that a reader of the call site would not
  expect.
- The TypeScript inference around it produces obscure error
  messages on misuse.
- Editor hover output for the resulting type is too long or too
  nested to read.

## Type-level work has costs

Conditional types, mapped types, template-literal types, and
recursive type tricks are tools, not goals. They are appropriate
when:

- They catch real misuse at compile time (a wrong event family on
  a handler, a prop that does not belong on the chosen widget,
  an event spec that does not match the widget's declared events).
- The error message they produce on misuse is something a user can
  act on without reading the SDK source.
- The hover output and `.d.ts` rendering of the resulting types
  remains readable.

They are inappropriate when:

- They make the user's TypeScript build slower in a way users
  notice.
- The misuse they catch is rare or already caught by a simpler
  runtime check.
- The error message they produce points at the SDK source, not at
  the user's code.
- A user can satisfy the type only by adding `as` casts, which
  defeats the point.

The bar is the user's experience, not the cleverness of the type.
A four-line `interface ButtonProps` beats a clever
`type ButtonProps<E> = ...` chain that catches the same mistakes
but is unreadable in a hover tooltip.

## `.d.ts` is what users read

Editor hover output, the typedoc-generated API reference, and
TypeScript error messages are the user's primary surface for the
DSL. Generated `.d.ts` for builders and components has to read
clearly:

- Function signatures show the actual parameter types, not
  inferred-from-generic placeholders that reveal the SDK's
  internal type machinery.
- Discriminated unions in event types render as named variants,
  not as anonymous unions of object types.
- Default values and optional fields are documented inline via
  JSDoc.
- Internal types are not re-exported from the public entry points
  even when they happen to be used in public type signatures; in
  that case, the public signature is rewritten to use the public
  alias.

A change to type machinery that makes the user-facing
`.d.ts` worse is the wrong direction, even if the type is
"correct" in some abstract sense.

## Compile time vs runtime

Compile-time checks via the type system are welcome when they
catch a real bug class with clear error messages:

- `DeepReadonly<M>` on the model parameter makes mutation a type
  error.
- Discriminated unions on `Event` and `Command` make exhaustive
  switches catch new variants at compile time.
- Type guards (`isClick`, `isTimer`, etc.) narrow the event type
  in handlers and `update` bodies.
- Native widget configs are typed; passing the wrong config shape
  is a compile error.

Compile-time checks are not welcome when:

- They require understanding values only available at runtime
  (event content, dynamic IDs, model shape that changes per app).
- The same bug class is catchable cleanly at runtime with a
  better error message.
- The check requires the user to satisfy a type that surprises
  them.

Runtime validation that the DSL relies on:

- The runtime validates that `view` returns window nodes at the
  top level; a bare `Column` or `Row` is an error.
- Tree normalization rejects malformed widget structs and surfaces
  a typed error.
- Promise-from-handler detection produces a clear "use
  `Command.async`" error.
- Scoped-ID detection (`/` in user-provided IDs) produces a clear
  error explaining the scoped-ID format.

These runtime guards mirror compile-time ones and exist for the
case where the type system is bypassed.

## Errors point at the user's call site

A type error that points at the user's wrong line is good. A type
error that asks the user to expand a deeply nested generic to
understand the mismatch is bad. The bar is "the user can correct
the call site without grepping the SDK source."

A useful error message:

- Names what is wrong in the user's terms (the prop name, the
  widget name, the event family).
- Names what was expected (the supported types, the supported
  containers, the required shape).
- Points at the user's source line, not the SDK source line.

Vague errors from the DSL are bug-class. They cost users time and
they cost us issue triage.

## What this looks like in practice

- A user proposes "let widgets accept a `deprecated` prop with a
  custom message that fires a console warning." Real bug class?
  Maybe (cross-SDK rename windows). Two real users? Currently no.
  Outcome: defer until a rename actually needs it; pre-1.0 we
  just rename.
- A user proposes "use template-literal types to parse scoped IDs
  at compile time." Real bug class? Misformatted IDs do happen.
  Two real users? Yes, every user. Generated `.d.ts` reads
  cleanly? Probably no; recursive template-literal types render
  poorly in hover output. Error messages on misuse? Probably bad.
  Outcome: keep the runtime check with the clear error; the
  type-level check costs more than it saves.
- A user proposes "auto-derive prop types for new widgets from a
  schema." Real bug class? Prop drift between similar widgets is
  a recurring issue. Two real users? Yes, every new widget. The
  generated types read cleanly? Yes for primitive props; no for
  widgets with custom prop coercion. Outcome: incremental,
  auto-derive for simple cases, hand-written types for complex
  ones, with the line documented.
