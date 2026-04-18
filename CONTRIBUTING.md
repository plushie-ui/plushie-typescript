# Contributing

## Setup

```sh
git clone https://github.com/plushie-ui/plushie-typescript.git
cd plushie-typescript
pnpm install
npx plushie download   # download the renderer binary
pnpm preflight         # verify everything works
```

Requires Node.js 20+ and pnpm. The project uses
[mise](https://mise.jdx.dev/) for tool version management but it is
not required; any recent Node.js and pnpm will work.

## Preflight

Run this before every commit:

```sh
pnpm preflight
```

This runs, in order:

1. **Lint** (`pnpm lint`): Biome linter and formatter check
2. **Type check** (`pnpm check`): `tsc --noEmit` with strict settings
3. **Build** (`pnpm build`): tsup (ESM + CJS + declarations)
4. **Test** (`pnpm test`): vitest, all unit and integration tests
5. **Docs** (`pnpm docs:check`): TypeDoc API reference (warnings as errors)

Preflight mirrors CI. If it passes locally, CI will pass.

## Commands

```sh
pnpm preflight          # all checks (lint + check + build + test + docs)
pnpm lint               # biome check
pnpm format             # biome format --write (auto-fix)
pnpm check              # tsc --noEmit
pnpm test               # vitest run
pnpm test:watch         # vitest (watch mode)
pnpm build              # tsup
pnpm docs               # generate API reference (api-docs/)
pnpm docs:check         # generate API reference (warnings as errors)
```

## Code style

Formatting and linting are handled by [Biome](https://biomejs.dev/).
Run `pnpm format` to auto-fix formatting issues.

Key style points:

- **2-space indent**, LF line endings, trailing newlines
- **Semicolons required**
- **100-character line width**
- **Bracket notation** for wire protocol keys (`result["type"]` not
  `result.type`); this makes it explicit which keys are wire format
  strings vs TypeScript property access
- **Non-null assertions** are allowed (`!`); the type system can't
  always prove non-nullity in array/map access patterns
- **No `as any`** in production code. Tests may use it sparingly for
  mocking, but prefer proper typing.

## TypeScript strictness

The project enables every useful strict flag:

- `strict` (includes strictNullChecks, strictFunctionTypes, etc.)
- `noUncheckedIndexedAccess`: array/map access returns `T | undefined`
- `exactOptionalPropertyTypes`: `undefined` is not assignable to
  optional properties
- `noPropertyAccessFromIndexSignature`: forces bracket notation for
  index signatures
- `verbatimModuleSyntax`: import/export must match module system

These catch real bugs. Do not relax them.

## Project structure

```
src/
  index.ts              # main entry point
  app.ts                # app() factory
  types.ts              # core types (UINode, Command, Event, etc.)
  command.ts            # Command constructors
  subscription.ts       # Subscription constructors
  events.ts             # event type guards
  runtime.ts            # update loop, handler dispatch
  effects.ts            # platform effects (file dialogs, clipboard)
  animation.ts          # easing functions, animation lifecycle
  selection.ts          # selection state helpers
  undo.ts               # undo/redo stack
  route.ts              # navigation routing
  data.ts               # query pipeline (filter, search, sort, paginate)
  keys.ts               # keyboard key constants
  client/               # binary management, transport, wire protocol
  tree/                 # tree normalization, diffing, search
  ui/                   # widget builders, prop types
    widgets/            # one file per widget type
  canvas/               # canvas shapes, path, transforms
  testing/              # test framework (session pool, helpers)
  cli/                  # CLI tool (npx plushie ...)
test/                   # tests mirror src/ structure
examples/               # example apps
docs/                   # guides
```

## Writing tests

Tests live in `test/` and mirror the `src/` directory structure.

**Unit tests** cover internal logic (framing, protocol encode/decode,
tree diffing, prop type encoding, command construction). These are
pure TypeScript with no binary dependency.

**Integration tests** go through the real plushie binary. There are
no TypeScript-side mocks or stubs. The binary is fast enough (mock
mode is sub-millisecond per interaction) that mocking adds complexity
without value.

```typescript
import { testWith } from "plushie/testing"
import counter from "./counter"

const test = testWith(counter)

test("increments on click", async ({ session }) => {
  await session.click("increment")
  expect(session.model().count).toBe(1)
  session.assertText("count", "Count: 1")
})
```

Test backends are selectable via environment variable:

```sh
pnpm test                                    # mock (default, fastest)
PLUSHIE_TEST_BACKEND=headless pnpm test      # real rendering, no display
PLUSHIE_TEST_BACKEND=windowed pnpm test      # real windows (needs Xvfb)
```

### Doc tests

Documentation code blocks are tested via HTML comment markers. Each
code block in `docs/` has a comment like:

```markdown
<!-- test: my_test_name -->
```

The corresponding test in `test/docs/` references this marker and
verifies the code block compiles and behaves correctly. When updating
docs, update the tests too.

## Writing widgets

Widget builders live in `src/ui/widgets/`, one file per widget type.
Each exports:

- A **PascalCase** JSX component (`Button`, `TextInput`)
- A **camelCase** function (`button`, `textInput`)

Both return `UINode` and are re-exported from `src/ui/index.ts`.

Handler props (`onClick`, `onInput`, etc.) are collected during
`view()` into a handler map and are **not** included in the wire
props sent to the renderer. See `src/ui/handlers.ts` for the
collection mechanism and `src/ui/build.ts` for the `extractHandlers`
helper.

Prop types must match the wire protocol. Reference
`~/projects/plushie/docs/protocol.md` for wire format and
`~/projects/toddy-elixir/lib/plushie/widget/` for field-level
parity with the Elixir SDK.

## Commit messages

Use [conventional commit](https://www.conventionalcommits.org/) style:

```
feat: add combo box widget
fix: handle empty children in tree diff
chore: update biome config
docs: expand testing guide
test: add prop encoding edge cases
refactor: simplify subscription diffing
```

## Adding dependencies

The project has **one runtime dependency**: `@msgpack/msgpack`. This
is intentional. Every additional dependency is attack surface,
version churn, and bundle bloat.

Before adding a dependency, consider:

- Can this be done in a few lines of TypeScript?
- Is this a build/dev-only dependency? (Those are fine.)
- Does this pull in a transitive dependency tree?

Dev dependencies (vitest, tsup, biome, typescript) are fine to add
when there is clear value.

## Pull requests

- Branch from `main`
- Run `pnpm preflight` before pushing
- Keep PRs focused: one concern per PR
- Include tests for new functionality
- Update docs if user-facing behavior changes

CI runs on every PR: lint, type check, build, binary download, test,
API docs, across Node.js 20 and 22.

## Binary management

The plushie binary is downloaded automatically on `npm install` via
the postinstall script (`scripts/postinstall.mjs`). The script is
non-fatal: if the download fails, `npm install` still succeeds and
the user can run `npx plushie download` manually.

The postinstall is skipped when:
- `PLUSHIE_SKIP_DOWNLOAD=1` is set
- `PLUSHIE_BINARY_PATH` is set (user has their own binary)
- Running in CI without `PLUSHIE_DOWNLOAD_IN_CI=1`

The plushie-rust release version is pinned in `src/client/binary.ts`
(`PLUSHIE_RUST_VERSION`). When updating, change both the constant and
the version in `scripts/postinstall.mjs`.

## Releasing

Releases are triggered by pushing a version tag:

```sh
# Update version in package.json
pnpm preflight
git commit -am "release: v0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

The release workflow (`.github/workflows/release.yml`) verifies the
tag matches `package.json` version, runs preflight, and publishes to
npm with provenance attestation.

## API documentation

[TypeDoc](https://typedoc.org/) generates API reference from TSDoc
comments. Run `pnpm docs` to generate locally (output in `api-docs/`,
gitignored). All public exports should have TSDoc comments; the
`pnpm docs:check` step enforces this by treating warnings as errors.

## Architecture decisions

This is a **TypeScript-native SDK**, not an Elixir port. The wire
protocol is shared with plushie-elixir and plushie-gleam, but the
API design should feel natural in TypeScript:

- JSX for views (not template strings or builder chains)
- Inline pure-function handlers for widget events (not a central
  `update()` dispatcher, though that's supported too)
- Discriminated unions for events (not class hierarchies)
- Spread syntax for immutable updates (not Immer by default)
- Frozen Symbol-tagged objects for commands (not class instances)

When in doubt, consult the wire protocol spec as the authoritative
source and design the TypeScript API to be the most natural way to
produce and consume those wire messages.
