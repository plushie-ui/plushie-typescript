# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Breaking changes

- Environment variable `PLUSHIE_SOURCE_PATH` renamed to
  `PLUSHIE_RUST_SOURCE_PATH`, matching plushie-rust.
- Constant `BINARY_VERSION` renamed to `PLUSHIE_RUST_VERSION` in
  `src/client/binary.ts`. This is the precise plushie-rust release
  pin; see `docs/versioning.md`.
- `NativeWidgetConfig.rustConstructor` removed. Each native widget
  crate now declares its own `[package.metadata.plushie.widget]`
  table (`type_name`, `constructor`) in `Cargo.toml`, matching
  plushie-rust conventions.
- Deleted `src/native-widget-build.ts` and the `NativeWidgetBuildConfig`
  export. Cargo workspace generation, patch forwarding, collision
  checks, and constructor validation now live in the `cargo-plushie`
  build tool.

### Changed

- `npx plushie build` shells out to `cargo plushie build` instead of
  generating its own Cargo workspace. Two install paths are
  supported: `cargo install cargo-plushie --version <pin>` or
  pointing `PLUSHIE_RUST_SOURCE_PATH` at a plushie-rust checkout.
- Custom renderer binaries land in `node_modules/.plushie/bin/`
  using the platform naming convention, unifying resolution for
  stock downloads and custom builds.

### Added

- `src/cli/cargo-plushie.ts` with `resolveCargoPlushie()` for
  locating the build tool.
- `docs/versioning.md` documenting the two-axis policy and the
  exact-match `PLUSHIE_RUST_VERSION` rule.

## [0.5.0] - 2026-03-23

Initial release of the plushie TypeScript SDK. Targets
plushie-renderer 0.5.0.

### Added

- **App framework** with inline pure-function event handlers and optional
  `update()` fallback. JSX and function API for widget construction.
  `DeepReadonly<M>` model type prevents accidental mutation.
- **38 widget builders**: layout (column, row, container, scrollable,
  stack, overlay, grid, keyed_column, responsive, pin, floating),
  display (text, rich_text, markdown, image, svg, progress_bar, qr_code,
  rule, space), input (button, text_input, text_editor, checkbox, radio,
  toggler, slider, vertical_slider, pick_list, combo_box), complex
  (table, pane_grid, tooltip, mouse_area, sensor, themer, window, canvas).
- **Canvas shape system** with shape primitives (rect, circle, line, text,
  path, image, svg), groups with transforms/clips/interactive fields,
  stroke builder, and linear gradients. Groups support `focus_style`,
  `show_focus_ring`, `focusable` for keyboard navigation. Canvas widget
  supports `role` and `arrowMode` props.
- **Full wire protocol** implementation for MessagePack (4-byte
  length-prefixed) and JSON (newline-delimited) formats.
- **Tree normalization** with scoped IDs, auto-ID detection, a11y
  reference resolution, and duplicate sibling ID warnings.
- **Incremental tree diffing** with patch generation. O(n) reorder
  detection.
- **Coalescable event buffering** for high-frequency events via
  queueMicrotask.
- **Command system**: async (with AbortSignal), stream
  (AsyncIterable), cancel, sendAfter, batch, exit, focus, scroll,
  select, cursor, announce, focusElement, window ops, image ops,
  pane ops, extension commands, queries, effects.
- **Subscription lifecycle** with key-based diffing, max_rate change
  detection, and timer management.
- **Three-tier testing framework** (mock, headless, windowed) via real
  plushie binary. Session pool for multiplexed test sessions.
- **Platform effects**: file dialogs, clipboard, notifications with
  per-kind timeouts.
- **State helpers**: animation (8 easing functions), selection
  (single/multi/range), undo/redo with coalescing, navigation routing,
  data query pipeline (filter, search, sort, paginate).
- **WASM renderer support** via WasmTransport for browser deployment.
- **Node.js SEA** (Single Executable Application) bundling support.
- **Unix socket and TCP transport** via SocketTransport for remote
  rendering.
- **Dev server** with file watching and debounced reload.
- **Extension widget system** with container support, command
  generation, and Cargo workspace scaffolding for native Rust
  extensions. Build-time functions isolated for browser compatibility.
- **.plushie script** parser and runner for automated testing.
- **Binary download** from GitHub releases with SHA256 verification.
- **CLI**: download, build, dev, run, stdio, inspect, connect,
  script, replay. Supports `--bin-file` and `--wasm-dir` flags.
- **Postinstall binary download**: automatic on `npm install`.
- **TypeDoc API reference** generation with warnings-as-errors.
- **Biome** linter and formatter.
- **GitHub Actions CI** and tag-triggered release workflow.

[0.5.0]: https://github.com/plushie-ui/plushie-typescript/releases/tag/v0.5.0
