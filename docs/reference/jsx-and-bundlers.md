# JSX and bundlers

Plushie is written as an ESM TypeScript package with a JSX
automatic runtime. A minimum-viable project needs two tsconfig
settings, a few dev dependencies, and the `plushie` CLI. Bundlers
are optional: Node-only apps can ship TypeScript directly via
`tsx` and the shipped CLI. Browser and WASM apps pick any bundler
that serves ES modules and `.wasm` files.

The JSX runtime lives at `plushie/jsx-runtime` and
`plushie/jsx-dev-runtime`. WASM resolution lives in `plushie`
(`resolveWasm`) and `plushie/client` (`WasmTransport`). SEA
helpers live in `plushie` (`isSEA`, `extractBinaryFromSEA`,
`generateSEAConfig`).

## tsconfig essentials

A project that uses Plushie JSX needs the automatic runtime
pointed at the `plushie` import source:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plushie",

    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,

    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

`jsxImportSource: "plushie"` makes the compiler look up
`plushie/jsx-runtime` and `plushie/jsx-dev-runtime`. Both are
declared in the SDK's `package.json` `exports` map, so no path
mapping is needed.

`target` of `ES2022` matches the SDK itself. Older targets still
compile, but the runtime assumes native `structuredClone`,
`AbortController`, and top-level `await`, all of which `ES2022`
provides.

`moduleResolution: "bundler"` is the recommended setting: it
matches how most bundlers resolve, handles the SDK's conditional
exports cleanly, and needs no file extensions on relative imports
inside your own project. Use `"node16"` instead if you need the
Node typing story verbatim (for example, when publishing a
library that re-exports Plushie types and wants strict ESM/CJS
resolution).

The strictness flags are not required, but the SDK is authored
against them and its public types assume callers use them. In
particular, `exactOptionalPropertyTypes` makes
`WindowNode | WindowNode[] | null` behave the way the view
signature expects.

`verbatimModuleSyntax` keeps `import type` and `export type`
honest: the emitted JavaScript matches the source without hidden
elision. Combine with `isolatedModules` when any build tool
(including `tsx`, `esbuild`, `swc`, or `tsup`) emits files one at
a time.

## Package exports

The `plushie` package publishes the following subpath entries.
Each resolves to both ESM (`.js` + `.d.ts`) and CJS
(`.cjs` + `.d.cts`):

| Subpath | Purpose |
|---|---|
| `plushie` | Runtime factory (`app`), `Command`, `Subscription`, `Effect`, event type guards, model helpers. |
| `plushie/ui` | Widget component functions and JSX components (`Button`, `Column`, `button()`, `column()`, ...). |
| `plushie/jsx-runtime` | JSX automatic production runtime (`jsx`, `jsxs`, `Fragment`). Imported by the compiler, not by user code. |
| `plushie/jsx-dev-runtime` | JSX automatic dev runtime. Currently re-exports the production runtime. |
| `plushie/canvas` | Canvas primitives (`rect`, `path`, `layer`, ...). |
| `plushie/testing` | `testWith`, session helpers, backend selection. |
| `plushie/client` | Transports, `resolveBinary`, `PROTOCOL_VERSION`, wire codec. Rarely imported directly. |

Keep imports on the highest-level subpath that exposes the name
you need. `plushie/ui` is the right place for widgets;
`plushie/client` is only for code that talks to the renderer
directly (custom transports, SEA bootstrap).

## Node-first projects

A pure desktop app that never runs in the browser does not need a
bundler. The SDK ships a CLI that wraps `tsx` for direct
TypeScript execution.

Install `tsx` as a dev dependency once:

```bash
pnpm add -D tsx
```

Then:

```bash
npx plushie dev src/main.tsx   # watch mode
npx plushie run src/main.tsx   # single run
```

`plushie dev` and `plushie run` shell out to the locally
installed `tsx`. The CLI checks `node_modules/.bin/tsx` first,
then falls back to `PATH`. If `tsx` is not installed, it exits
with a one-line install hint. See the [CLI commands](cli-commands.md)
reference for the full command surface.

For projects that prefer pre-compilation (publishing a binary,
running under plain Node without `tsx`), use any TypeScript
bundler that emits ESM. The SDK itself is built with `tsup`:

```typescript
// tsup.config.ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: { app: "src/main.tsx" },
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
})
```

`esbuild`, `swc`, and `rollup` all work the same way. None of
them need Plushie-specific plugins because the JSX automatic
runtime is a plain ES module import.

### Hot reload

`plushie dev` runs the app under `tsx --watch`. On a source file
change `tsx` restarts the process and the SDK reconnects to the
renderer. Model state is not preserved across restarts; the app
reinitializes from `init`. See the
[app lifecycle reference](app-lifecycle.md) for detail on how
the handshake is re-run after a reload.

## Browser and WASM

Browser deployments use the `WasmTransport` from
`plushie/client` instead of the default `SpawnTransport`. The
WASM renderer runs in the same JavaScript context and the SDK
speaks JSON to it (the WASM module does not implement msgpack
framing).

```typescript
import init, { PlushieApp } from "plushie-wasm"
import { app } from "plushie"
import { WasmTransport } from "plushie/client"
import counter from "./counter"

await init()
const transport = new WasmTransport(PlushieApp)
await counter.run({ transport })
```

### Loading the WASM artifact

`npx plushie download --wasm` fetches a precompiled WASM bundle
from the plushie-rust release matching `PLUSHIE_RUST_VERSION` and
writes it to `node_modules/.plushie/wasm/`. The directory contains
the wasm-bindgen output pair:

- `plushie_renderer_wasm.js`
- `plushie_renderer_wasm_bg.wasm`

`resolveWasm(wasmDir?)` from `plushie` looks up these files in the
following order:

1. `PLUSHIE_WASM_PATH` environment variable.
2. The `wasmDir` argument, if provided.
3. `node_modules/.plushie/wasm/` (the download target).

For server-side rendering or SSR-adjacent tooling, call
`resolveWasm` directly. For browsers, point the bundler at the
same directory: the JS loader is a plain ES module and the `.wasm`
file is an asset.

### Vite

A minimal `vite.config.ts`:

```typescript
import { defineConfig } from "vite"

export default defineConfig({
  optimizeDeps: {
    exclude: ["plushie-wasm"],
  },
  assetsInclude: ["**/*.wasm"],
  server: {
    fs: {
      allow: ["..", "node_modules/.plushie"],
    },
  },
})
```

`optimizeDeps.exclude` keeps Vite from pre-bundling the
wasm-bindgen output (which breaks the JS loader's relative
`fetch` for the `.wasm` file). `assetsInclude` ensures `.wasm`
files are served as raw assets. `server.fs.allow` grants dev
server access to `node_modules/.plushie/wasm/` when that directory
sits outside the project root.

### esbuild

Use the `loader: { ".wasm": "file" }` rule and copy the JS loader
into the bundle graph:

```typescript
import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  format: "esm",
  outdir: "dist",
  loader: { ".wasm": "file" },
  external: [],
})
```

Then copy `node_modules/.plushie/wasm/plushie_renderer_wasm_bg.wasm`
alongside the bundle so the loader can `fetch` it at runtime. Or
set `PLUSHIE_WASM_PATH` in the page bootstrap and serve the files
from a static route.

### webpack

webpack resolves `.wasm` via the `asset/resource` type. Add a
rule:

```javascript
module.exports = {
  module: {
    rules: [
      { test: /\.wasm$/, type: "asset/resource" },
    ],
  },
  experiments: { asyncWebAssembly: true },
}
```

The wasm-bindgen loader calls `fetch` on a path relative to the
JS loader. webpack's `publicPath` must be set so that fetch lands
on the emitted asset.

### Other bundlers

The pattern is the same everywhere: import the wasm-bindgen JS
loader as an ES module, serve the sibling `.wasm` file as a
binary asset, and make sure the bundler does not rewrite the
loader's internal `fetch` path. Override with
`PLUSHIE_WASM_PATH` when the runtime directory differs from the
default download location.

## CJS and ESM

The SDK is authored as ESM (`"type": "module"` in
`package.json`). Every subpath export also has a `require`
condition that resolves to a CJS build with matching `.d.cts`
declarations. The SDK ships both forms to avoid the dual package
hazard: types for ESM consumers come from `.d.ts` files and types
for CJS consumers come from `.d.cts` files. Instance checks and
`Symbol`-based discriminants work across both because each class
and symbol is defined in a single shared module, not duplicated
per build.

CJS consumers:

```javascript
const { app } = require("plushie")
const { Button, Column } = require("plushie/ui")
```

Writers of Plushie apps should prefer ESM. The CJS build exists
for tools that embed Plushie indirectly (build tooling, test
harnesses, older Node scripts).

## Node.js single executable applications

`plushie/sea` exposes helpers for packaging a Plushie app as a
Node.js Single Executable Application (SEA). The SEA bundle
includes the renderer binary (and optionally the WASM files) as
embedded assets, so the resulting executable is fully
self-contained.

Runtime detection uses `isSEA()`. When true, `resolveBinary`
pulls the renderer out of the bundle via
`extractBinaryFromSEA("plushie-binary")`, writes it to `os.tmpdir()`
with a pid-stamped filename, and returns the extracted path.

To generate the SEA config at build time:

```typescript
import { generateSEAConfig } from "plushie"
import { writeFileSync } from "node:fs"

const config = generateSEAConfig({
  main: "dist/app.cjs",
  output: "build/app.blob",
  binaryPath: "node_modules/.plushie/bin/plushie-renderer-linux-x64",
  wasmDir: "node_modules/.plushie/wasm",
})

writeFileSync("sea-config.json", JSON.stringify(config, null, 2))
```

The config's `main` must point at a CJS file. Bundle the app
(via tsup, esbuild, or webpack) to CJS first, then feed it to
`node --experimental-sea-config` per the
[official SEA docs](https://nodejs.org/api/single-executable-applications.html).

The assets map uses the keys `plushie-binary`, `plushie-wasm-js`,
and `plushie-wasm-bg`. Keep those names if the generated
executable should work with the SDK's default resolution; pass
custom keys to `extractBinaryFromSEA` and a custom `resolveWasm`
if you override them.

## Wire format and prop naming

Bundlers do not interact with the wire protocol, but a note for
first-time debuggers: props in TypeScript are camelCase
(`onClick`, `contentFit`, `eventRate`, `maxWidth`), and the SDK
renames them to snake_case at the wire boundary (`on_click`,
`content_fit`, `event_rate`, `max_width`). This is invisible from
application code and from bundler output. It only appears in
msgpack / JSON dumps and in the
[wire protocol reference](wire-protocol.md).

The rename is done by each widget builder, not by a global
transform. Dead-code elimination and minification do not change
the wire shape. If a bundler rewrites object keys (some aggressive
minifiers do), disable that pass for the SDK's `dist/` tree.

## Common pitfalls

**Lowercase intrinsic tags.** `<button>` is an HTML intrinsic in
TypeScript's JSX and does not resolve to the Plushie `Button`
component. JSX that looks right but produces string-typed nodes
on the wire is almost always a lowercase tag. Import the
PascalCase component:

```tsx
import { Button, Column } from "plushie/ui"

<Column>
  <Button id="save" onClick={(s) => ({ ...s, saved: true })}>Save</Button>
</Column>
```

**Mismatched `jsxImportSource`.** A stray `"jsx": "react"` or
`"jsxImportSource": "react"` in a transitive `tsconfig.json`
silently routes JSX through React's runtime. The tsc error
message points at an unresolved `react/jsx-runtime` import. Fix
the `jsxImportSource` in the project's primary tsconfig; extends
chains inherit.

**Forgetting the renderer download.** A fresh `pnpm install`
triggers the postinstall script, which downloads the renderer
binary for the current platform. If the script is skipped (CI,
`PLUSHIE_SKIP_DOWNLOAD=1`, network failure), the first
`plushie run` exits with guidance to run
`npx plushie download` by hand. Set `PLUSHIE_DOWNLOAD_IN_CI=1` in
CI environments that need the binary available.

**WASM files in the wrong directory.** The wasm-bindgen JS
loader `fetch`es `plushie_renderer_wasm_bg.wasm` relative to
itself. If the bundler splits the pair or rewrites the fetch
path, set `PLUSHIE_WASM_PATH` to a static directory both files
sit in.

**ESM-only imports in CJS contexts.** A `require("plushie")` in
a CJS file hits the `.cjs` build, not the ESM build. The public
API is identical, but library authors who re-export Plushie
types should verify that `.d.ts` and `.d.cts` both resolve in
their consumers' setups.

## See also

- [CLI commands](cli-commands.md)
- [Configuration](configuration.md)
- [Wire protocol](wire-protocol.md)
- [Versioning](versioning.md)
- [App lifecycle](app-lifecycle.md)
