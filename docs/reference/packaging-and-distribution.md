# Packaging and Distribution

`plushie package` turns a Plushie app into a self-contained
artifact that ships with its own Node.js runtime and Plushie
renderer. The output is either a portable single-file executable
or an OS-native installer (AppImage, `.dmg`, `.msi`). The
recipient does not need Node, npm, or anything else installed.

When the artifact runs, the launcher extracts the payload, starts
the packaged host executable, and the host starts its renderer
from inside the payload. The flow is the same as `plushie run`,
just running from an extracted directory instead of your project.

| Section | Topic |
|---|---|
| [Quickstart](#quickstart) | Three commands from a working app to a portable artifact |
| [The packaging pipeline](#the-packaging-pipeline) | How the SDK, cargo-plushie, and the launcher hand off |
| [plushie package](#plushie-package) | Command flags and what the command owns |
| [The payload](#the-payload) | What goes into the packaged payload directory |
| [Source layout](#source-layout) | What to commit and what to gitignore |
| [Renderer selection](#renderer-selection) | Stock versus custom |
| [Bundled assets](#bundled-assets) | Icons, fonts, and other payload files |
| [The host SEA](#the-host-sea) | Node Single Executable Application as host payload |
| [The managed tool set](#the-managed-tool-set) | `bin/plushie`, renderer, launcher |
| [The partial manifest](#the-partial-manifest) | TOML the SDK writes |
| [Package config](#package-config) | `plushie-package.config.toml` schema |
| [Forwarded environment](#forwarded-environment) | Host process environment policy |
| [Building artifacts](#building-artifacts) | Portable executable and OS installers |
| [Distribution](#distribution) | Release asset layout |
| [Continuous integration](#continuous-integration) | GitHub Actions workflow |
| [Signing](#signing) | Developer-driven signing hooks |
| [Updates](#updates) | `[updates]` schema |
| [Host-first versus renderer-parent](#host-first-versus-renderer-parent) | Default launch model and the alternative |

## Quickstart

Three commands take a working app to a portable artifact:

```bash
npx plushie download                                                              # install Plushie tool set
npx plushie package --app-id dev.example.my_app --main dist/app.cjs               # build payload + manifest
bin/plushie package portable --manifest dist/plushie-package.toml                 # produce the artifact
```

Output lands under `target/plushie/package/`. `--app-id` and one
of `--main` or `--host-bin` are the only required flags.

`--main` expects a bundled CommonJS host entry. Plushie does not
ship a bundler; produce `dist/app.cjs` with `tsup`, `esbuild`, or
whatever your project already uses. See
[JSX and bundlers](jsx-and-bundlers.md) for project-side
bundling guidance.

## The packaging pipeline

A packaged app moves through three stages:

1. **SDK build.** `plushie package` resolves a host SEA from the
   bundled `--main` entry (or copies the prepared `--host-bin`),
   copies the renderer into `dist/payload-root/`, writes a
   partial `dist/plushie-package.toml` carrying SDK identity,
   version pins, target triple, and the renderer descriptor.
2. **Manifest assembly.** `plushie package` then shells out to
   `bin/plushie package assemble`. cargo-plushie validates the
   payload, reads `plushie-package.config.toml` for `[start]`
   defaults and `[platform]` metadata, materializes the icon,
   archives the payload, computes its SHA-256 and size, and
   fills in the rest of `plushie-package.toml`.
3. **Artifact build.** `bin/plushie package portable` produces a
   self-extracting single-file executable.
   `bin/plushie package bundle` produces OS-native installers via
   [cargo-packager](https://github.com/crabnebula-dev/cargo-packager).
   Both consume the same completed manifest.

Stage 1 is TypeScript-specific. Stages 2 and 3 are
language-agnostic and shared across every Plushie SDK; the same
`bin/plushie` tool that assembles a TypeScript payload assembles
an Elixir or Python payload.

## plushie package

Stage 1 of the pipeline. The command builds (or copies) the host
executable, copies the renderer into the payload, writes the
partial manifest, and shells to `bin/plushie package assemble` to
complete it.

Choose exactly one host input:

| Flag | Description |
|---|---|
| `--main <path>` | Bundled CommonJS host entry. The SDK turns it into a host-only Node SEA executable. |
| `--host-bin <path>` | Prepared host executable copied verbatim into the payload. |

Package metadata and output flags:

| Flag | Description |
|---|---|
| `--app-id <id>` | Package app identifier. Required. |
| `--app-name <name>` | Display app name. Used by cargo-plushie for OS-native bundles. |
| `--app-version <v>` | App version. Defaults to local `package.json` `version`, then `0.1.0`. |
| `--host-name <name>` | Payload-local host executable name. Defaults to `<package-name>-host` (with `.exe` on Windows). |
| `--output <dir>` | Output directory. Defaults to `dist`. |
| `--target <target>` | Override package target such as `linux-x86_64`. |
| `--renderer-kind stock\|custom` | Renderer selection. Auto-detected when absent. |
| `--renderer-path <path>` | Use an existing renderer binary. |
| `--package-config <path>` | Source package config path forwarded to `cargo plushie package assemble`. |
| `--write-package-config` | Write a `plushie-package.config.toml` template and exit. |

`--app-id` is a reverse-DNS identifier in the
`namespace.[subnamespace.]app` form (`dev.example.my_app`,
`com.acme.invoice`). cargo-plushie validates the format during
assembly.

The output directory is rebuilt from scratch on every run.
Anything under `dist/` from a previous run is removed before the
new payload is assembled.

## The payload

`dist/payload-root/` is the directory that gets archived into the
artifact:

```
dist/
  plushie-package.toml             # manifest (partial then completed)
  payload-root/
    bin/
      my-app-host                  # host SEA executable (or copied --host-bin)
      plushie-renderer             # payload-local renderer copy
    assets/                        # icon and other files from package_assets/
                                   #   (see Bundled assets below)
```

There is no `start_host` shell wrapper. The host SEA executable
is the entry point: SEA bakes the Node runtime and the bundled JS
into a single native binary, so the launcher invokes it directly.
The shared package launcher sets `PLUSHIE_BINARY_PATH` to the
payload-local renderer before exec'ing the host, and the SDK's
binary resolution picks that up like any other deployment. The
packaged app never reaches out to the system `PATH` or a download
cache; everything it needs is inside the extracted payload.

## Source layout

Packaging adds project-owned files that belong in version control
and generated files that do not. Knowing which is which avoids
accidentally committing platform-specific binaries or losing
project-owned config.

| Path | What it is | Commit or gitignore |
|---|---|---|
| `plushie-package.config.toml` | Package config: start command, forward_env, platform metadata. Like `package.json`. | Commit. |
| `package_assets/` | Project-owned icon, fonts, and other files copied verbatim into the payload. | Commit. |
| `plushie.extensions.json` | Project-level config consumed by the CLI. | Commit when present. |
| `bin/` | Plushie tool set installed by `plushie download`: `plushie`, `plushie-renderer`, `plushie-launcher`. Platform-specific binaries. | Gitignore. |
| `dist/` | Package output: payload directory and manifest. Rebuilt by every `plushie package` run. | Gitignore. |
| `target/plushie/` | Portable and bundle artifacts produced by `bin/plushie package portable` / `bundle`. | Gitignore. |
| `node_modules/` | npm dependencies. | Already in default `.gitignore`. |

A minimum `.gitignore` for a packaging-enabled project looks like:

```
/node_modules/
/bin/
/dist/
/target/
```

`plushie download`, `plushie package`, and
`bin/plushie package portable` each check whether their output
path is gitignored when run inside a git repository. If it is
not, they print a one-paragraph warning naming the directory and
the line to add. The command still succeeds; the warning is just
a nudge.

## Renderer selection

The command picks a renderer based on whether your project
declares [native widgets](custom-widgets.md) (Rust-backed widgets
that ship their own crate):

- **No native widgets.** A stock renderer is bundled. By default,
  it comes from the managed tool set installed by
  `plushie download`.
- **Native widgets present.** A custom renderer is required.
  Build it with `plushie build`, then pass `--renderer-kind
  custom` together with `--renderer-path` (or set
  `PLUSHIE_BINARY_PATH`) so the payload carries the right binary.

Override the auto-detection with `--renderer-kind stock|custom`.
Requesting `--renderer-kind stock` for an app that declares
native widgets fails fast, because a stock renderer cannot
include those widget crates.

Stock renderer resolution order:

1. `--renderer-path <path>`.
2. `PLUSHIE_BINARY_PATH`.
3. `PLUSHIE_RUST_SOURCE_PATH` with `bin/plushie tools sync`.
4. The downloaded binary at `bin/plushie-renderer`.

Custom renderer packaging requires an explicit binary path so a
stock renderer is not mislabeled as custom.

## Bundled assets

A packaged app needs two kinds of files beyond the host executable:
the icon and other OS-bundle metadata that cargo-plushie reads
from the manifest, and runtime assets that your app loads at
startup (fonts, images, data files). Each has a different home.

### App-loaded assets

Anything your app reads at runtime should resolve through the
host executable's own filesystem layout. In a packaged app, the
host executable lives at `<payload>/bin/<app>-host` and the
extracted payload root is one directory up. The Node idioms apply
inside SEA:

```typescript
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Locate a file relative to the host executable. process.execPath
// inside a SEA bundle points at the host executable itself.
const payloadRoot = dirname(dirname(process.execPath))
const fontPath = join(payloadRoot, "assets", "fonts", "inter.ttf")
```

Reference resolved paths from `settings.fonts`,
`Command.image`, or any widget that takes a file path. There is
no separate packaging step. If the file is inside the payload, the
host can read it.

For browser-style assets that should travel inside the SEA blob
itself rather than as separate payload files, use SEA assets via
`process.getAsset()`. Both work; payload-root files are simpler
to update and debug, SEA assets are tamper-resistant.

### Package-level assets (package_assets/)

Files that need to live inside the payload at a known location,
such as the OS bundle icon referenced from `[platform].icon`, go
in a `package_assets/` directory next to
`plushie-package.config.toml`. cargo-plushie copies the contents
verbatim into the payload root during
`bin/plushie package assemble`:

```
my_app/
  package.json
  plushie-package.config.toml
  package_assets/
    icon.png                # ends up at payload/icon.png
    fonts/
      extra.ttf             # ends up at payload/fonts/extra.ttf
```

The convention is zero-config: if `package_assets/` exists, it is
used. To use a different directory name, set `[assets].dir` in
the package config:

```toml
[assets]
dir = "branding"
```

Asset files overwrite SDK-generated payload files when the names
collide. Use this for overrides, not by accident; the default
layout has no overlap.

### Icon

cargo-plushie looks for an icon at the path named in
`[platform].icon` inside the payload. If no path is set and a
file already exists at `assets/default-app-icon-512.png`, that
path is recorded. If nothing exists at either location,
cargo-plushie writes the built-in default icon to
`assets/default-app-icon-512.png` and records that path.

**Format:** PNG with RGBA alpha channel for transparency.

**Dimensions:** square aspect ratio, 512x512 minimum.
cargo-packager scales this single source down for `.ico`
(16/32/48/64/128/256) and up or down for `.icns`
(16/32/64/128/256/512/1024). Provide 1024x1024 or larger if the
same icon will be used for retina displays or high-DPI Windows
installers.

To use a custom icon, put a PNG in `package_assets/` and
reference it from `[platform].icon`:

```toml
[platform]
icon = "icon.png"               # payload-relative; resolves to payload/icon.png
                                # after package_assets/icon.png is copied
```

The schema accepts a single icon path. Multi-size sources and
per-platform `.icns`/`.ico` overrides are not yet supported.

## The host SEA

`plushie package --main <path>` produces a Node Single Executable
Application (SEA): a copy of the `node` binary with the bundled
JS injected as a payload blob. Building one is a few discrete
steps that `plushie package` runs for you:

1. Generate a SEA config (`sea-config.json`) pointing at
   `--main` and a temporary prep blob path.
2. Run `node --experimental-sea-config sea-config.json` to
   produce the prep blob.
3. Copy the current `node` executable to the payload location.
4. Run `npx postject` to inject the prep blob into the copy.
5. On macOS, strip and re-apply an ad-hoc code signature so the
   injected binary launches.

The Node executable used as the base is whichever `node` is
running `plushie package`. Build on a runner that matches the
target OS and architecture; cross-target SEA bundling (building a
Linux host on macOS, for example) is not currently a supported
flow.

`--main` must point at a CommonJS bundle. ESM is not yet
supported as a SEA entry by Node. Most TypeScript bundlers
(`tsup`, `esbuild`, `webpack`) emit CJS via a config flag; pick
that output for the SEA entry and a separate ESM build for any
other consumers.

For projects that already prepare their own host executable
(self-contained `pkg` builds, Deno compile output, a different
SEA recipe), pass `--host-bin` instead. The SDK skips the SEA
steps and copies the file verbatim into the payload.

Node 20 or newer is required for SEA support, both at packaging
time and as the base node for the host.

## The managed tool set

`plushie download` installs three executables under `bin/`:

| File | Role |
|---|---|
| `plushie` | Orchestration tool. Owns `tools sync`, `package assemble`, `package portable`, `package bundle`. |
| `plushie-renderer` | The renderer binary used at runtime. Resolved by `resolveBinary` in `plushie/client`. |
| `plushie-launcher` | The shared launcher used by `package portable` to build the self-extracting artifact. |

The version of each file matches the `plushieRustVersion` pin in
`package.json`, exposed at runtime as `PLUSHIE_RUST_VERSION` from
`plushie/client`. `plushie download` downloads the `plushie` tool
first, then invokes `bin/plushie tools sync --required-version
VERSION` to fetch the matching renderer and launcher.

`plushie package` requires all three files. The renderer is
copied into the payload, `plushie` runs the assemble step, and
`plushie-launcher` is the substrate that `package portable` wraps
the payload with. The command raises early if any are missing
and prints a `plushie download` hint.

The Windows variants of these files carry an `.exe` suffix. The
tool name (`plushie` versus `plushie.exe`) is platform-specific;
the role is the same.

## The partial manifest

`plushie package` writes a TOML document with everything the SDK
knows: identity, versions, target, and the renderer descriptor. A
minimal partial manifest looks like:

```toml
schema_version = 1
app_id = "dev.example.my_app"
app_version = "0.1.0"
target = "linux-x86_64"
host_sdk = "typescript"
host_sdk_version = "0.6.0"
plushie_rust_version = "0.7.1"
protocol_version = 1

[start]
command = ["bin/my-app-host"]

[renderer]
path = "bin/plushie-renderer"
kind = "stock"
```

`bin/plushie package assemble` reads this file plus the payload
directory and writes the completed manifest in place. The
completed manifest adds:

- A `[payload]` section with the archive hash, size, and
  compression format.
- `[start].working_dir` and `[start].forward_env` defaults from
  the package config.
- A `[platform]` block if one is set in the package config.
- An `[icon]` entry pointing at the materialized icon image.

The split exists so that cargo-plushie owns the cross-SDK schema
once. Every Plushie SDK writes a partial manifest in this shape
and hands the rest to the same `package assemble` step.

## Package config

Optional defaults for the assemble step live in
`plushie-package.config.toml` at the project root. Generate a
template with:

```bash
npx plushie package --write-package-config
```

The template includes all supported fields commented out:

```toml
config_version = 1

[start]
command = ["bin/my-app-host"]
# working_dir = "."
# forward_env = [
#   "PATH",
#   "HOME",
#   "LANG",
#   "LC_ALL",
#   "XDG_RUNTIME_DIR",
#   "WAYLAND_DISPLAY",
#   "DISPLAY",
# ]

# [assets]
# # Project-relative directory copied verbatim into the payload root
# # during package assembly. When this section is absent, a directory
# # named `package_assets/` next to this config file is used by
# # convention if it exists.
# dir = "package_assets"

# [platform]
# publisher = "Your Name"
# copyright = "Copyright 2026 Your Name"
# category = "public.app-category.productivity"
# description = "Short app description"
# bundle_id = "com.example.app"

# [platform.macos]
# bundle_version = "1"

# [platform.windows]
# install_scope = "perUser"
```

`[start].working_dir` is relative to the extracted payload root.
`[start].command` is a structured argv; the first element is the
host SEA executable. The SDK adjusts the host name on
`windows-*` targets to match the `.exe` suffix.

`[start].forward_env` is the list of environment variable
**names** copied from the parent process into the host process
at launch time. Names only; values are never logged or recorded.
A typical Linux GUI app needs `PATH`, `HOME`, `LANG`, `LC_ALL`,
`XDG_RUNTIME_DIR`, `WAYLAND_DISPLAY`, and `DISPLAY`. Add more
entries when your app reads additional environment, for example
`RUST_LOG` during development.

The `[platform]` block populates OS-native bundle metadata. All
fields are optional. `bundle_id` defaults to `app_id`. The
`[platform.macos]` and `[platform.windows]` subtables carry
OS-specific fields and are also optional.

Use `--package-config PATH` to point at a config file outside the
project root.

## Forwarded environment

The package launcher does not blanket-inherit the user's
environment. It builds the host process environment from two
closed sources:

- The Plushie reserved namespace (`PLUSHIE_BINARY_PATH`, plus a
  small set of internal coordination variables that the launcher
  sets itself).
- The names listed in `[start].forward_env`.

Variables outside both sets are dropped. This matches the
renderer-subprocess environment policy in `plushie/client` and
gives packaged apps a predictable, narrow runtime environment
regardless of where the launcher is invoked from.

## Building artifacts

Once the manifest is complete, the same payload feeds two
artifact shapes.

### Portable single-file launcher

```bash
bin/plushie package portable --manifest dist/plushie-package.toml
```

Produces a self-extracting executable wrapping
`plushie-launcher` and the archived payload. Output lands under
`target/plushie/package/` by default; pass `--out PATH` to
override. The artifact is content-addressed by the payload hash,
so two builds of the same inputs produce a byte-identical
executable.

The launcher extracts the payload to a per-user cache directory
keyed by the payload hash. Repeated runs of the same artifact
reuse the extraction.

### OS-native installers

```bash
bin/plushie package bundle --manifest dist/plushie-package.toml --formats appimage
bin/plushie package bundle --manifest dist/plushie-package.toml --formats dmg,app
bin/plushie package bundle --manifest dist/plushie-package.toml --formats nsis
```

Delegates to
[cargo-packager](https://github.com/crabnebula-dev/cargo-packager)
for AppImage (Linux), `.app` and `.dmg` (macOS), and `.nsis` and
`.wix` (Windows). Format availability depends on the runner:
Apple formats need a macOS runner, Windows formats need a Windows
runner.

Both commands default to a strict-tools check: they verify that
the launcher, renderer, and `plushie` itself match the
SDK-pinned version. Pass `--lax-tools` to bypass the check; this
is intended for local experimentation and not for release
builds.

## Distribution

Artifacts are version-named and signed with SHA-256 sidecars in
the same layout the SDK uses to fetch its own managed tools:

```
BASE/vVERSION/ARTIFACT
BASE/vVERSION/ARTIFACT.sha256
```

GitHub releases match this layout naturally. Other hosting works
the same way: any HTTPS endpoint that serves
`vVERSION/ARTIFACT` and `vVERSION/ARTIFACT.sha256` is usable.

For local release verification, point `PLUSHIE_RELEASE_BASE_URL`
at a `file://` directory or a loopback HTTP server before assets
are uploaded. The download flow accepts both schemes alongside
the default HTTPS.

## Continuous integration

The following GitHub Actions workflow builds a portable artifact
per target on a `v*` tag push and uploads everything to a GitHub
release with SHA-256 sidecars. Drop it in at
`.github/workflows/release.yml` and edit the marked lines for
your app:

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write          # for uploading release assets

jobs:
  package:
    name: Package (${{ matrix.target }})
    runs-on: ${{ matrix.runner }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - target: linux-x86_64
            runner: ubuntu-latest
          - target: darwin-x86_64
            runner: macos-13
          - target: darwin-aarch64
            runner: macos-14
          - target: windows-x86_64
            runner: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Plushie tools
        run: pnpm exec plushie download

      - name: Bundle host entry
        # EDIT: replace with your project's bundler invocation
        run: pnpm run build

      - name: Build the package payload
        # EDIT: replace --app-id and adjust --main to your bundled entry
        run: |
          pnpm exec plushie package \
            --app-id dev.example.my_app \
            --main dist/app.cjs

      - name: Build the portable artifact
        run: bin/plushie package portable --manifest dist/plushie-package.toml

      - name: Compute SHA-256 sidecar
        shell: bash
        run: |
          cd target/plushie/package
          for f in *; do
            if [ -f "$f" ] && [[ "$f" != *.sha256 ]]; then
              shasum -a 256 "$f" | awk '{print $1}' > "$f.sha256"
            fi
          done

      - name: Upload to release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            target/plushie/package/*
          generate_release_notes: true
```

The workflow runs four parallel jobs, one per supported target.
Each installs dependencies, installs the Plushie tool set,
bundles the host entry, assembles the payload, produces the
portable artifact, computes a SHA-256 sidecar, and uploads both
files to the release that the tag push creates.

Lines to tweak for your project:

- The matrix runner labels (`macos-13` for Intel macOS,
  `macos-14` for Apple Silicon). GitHub-hosted runner labels
  change over time; pin or update as needed. Add
  `ubuntu-24.04-arm` (or use a self-hosted runner) for Linux
  aarch64.
- The Node version in `setup-node`. Node 20 or newer is required
  for SEA.
- The `Bundle host entry` step. Use your project's bundler
  (`tsup`, `esbuild`, `webpack`) to emit a CommonJS bundle, and
  point `--main` at the output.
- The `plushie package` arguments: `--app-id` and `--main`.
- Release notes: set `generate_release_notes` to `false` and add
  `body` (or `body_path`) if you write release notes by hand.

To also build OS-native installers, add a second matrix entry
that calls `bin/plushie package bundle --formats <list>` instead
of `package portable`, and adjust the upload glob accordingly.
Apple formats need a macOS runner with valid signing identities;
Windows formats need a Windows runner with the appropriate SDKs.

For private hosting, replace the upload step with whatever pushes
the artifact and sidecar to your release endpoint. Any service
that exposes the assets at `BASE/vVERSION/ARTIFACT` plus
`BASE/vVERSION/ARTIFACT.sha256` works with the download flow.

## Signing

`plushie-package.toml` carries a `[[signing.hooks]]` block: a
list of commands that run after the artifact is built. Pass
`--run-signing-hooks` to `package portable` or `package bundle`
to invoke them. Hooks are opt-in so release builds run them and
local experimentation does not.

Each hook is a structured argv. Use them for macOS notarization,
Windows code signing, Linux checksum attestation, or whatever
else the target platform needs. Plushie does not hold signing
keys; the hook commands do.

## Updates

`plushie-package.toml` reserves an `[updates]` block for update
channel metadata. The schema is in place. The runtime side that
consumes it, planned around
[cargo-packager-updater](https://github.com/crabnebula-dev/cargo-packager),
is not yet shipped.

## Host-first versus renderer-parent

Packaging is host-first. The launcher starts the host SEA
executable and the host starts its own renderer.

A separate renderer-parent flow exists for development and
embedding hosts. The renderer starts first, binds a Unix socket,
and spawns the TypeScript command with `PLUSHIE_SOCKET` pointing
at it:

```bash
plushie --listen \
  --exec-bin npx \
  --exec-arg plushie \
  --exec-arg connect \
  --exec-arg src/main.tsx
```

`plushie connect` reads the socket and connects. The SDK's
socket transport detects `PLUSHIE_SOCKET` and either connects to
the existing renderer or spawns its own.

The same SDK runtime is what the host SEA invokes in a packaged
app, so driving a packaged app from an external renderer is
possible but requires adding `PLUSHIE_SOCKET` and `PLUSHIE_TOKEN`
to `[start].forward_env` so the launcher passes the variables
through. This is not a default-on configuration.

## See also

- [CLI commands reference](cli-commands.md) - the full `plushie`
  command surface, including `download`, `build`, and `package`
- [Configuration](configuration.md) - environment variables,
  application config, and transport modes
- [JSX and bundlers](jsx-and-bundlers.md) - bundling guidance for
  producing the CommonJS host entry that `--main` consumes
- [Versioning](versioning.md) - SDK version, pinned renderer, and
  cross-SDK version pairing
- [Wire Protocol](wire-protocol.md) - message format, token
  handling, and renderer-parent startup
