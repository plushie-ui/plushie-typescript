# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.6.0] - 2026-05-09

Targets plushie-rust 0.7.1 (up from plushie-renderer 0.5.0).

### Breaking changes

- Environment variable `PLUSHIE_SOURCE_PATH` renamed to
  `PLUSHIE_RUST_SOURCE_PATH`, matching plushie-rust.
- Constant `BINARY_VERSION` renamed to `PLUSHIE_RUST_VERSION` in
  `src/client/binary.ts`. The precise plushie-rust release pin; see
  `docs/reference/versioning.md`.
- `NativeWidgetConfig.rustConstructor` removed. Each native widget
  crate now declares its own `[package.metadata.plushie.widget]`
  table (`type_name`, `constructor`) in `Cargo.toml`, matching
  plushie-rust conventions.
- Deleted `src/native-widget-build.ts` and the `NativeWidgetBuildConfig`
  export. Cargo workspace generation, patch forwarding, collision
  checks, and constructor validation now live in the `cargo-plushie`
  build tool.
- Command builders renamed for cross-SDK consistency: `Command.async`
  to `Command.task`, `Command.done` to `Command.dispatch`,
  `Command.widgetCommands` to `Command.widgetBatch`, `Command.gainFocus`
  to `Command.focusWindow`.
- Query constructors renamed to drop the `get` prefix: `getWindowSize`
  to `windowSize`, `getWindowPosition` to `windowPosition`, `getMode`
  to `windowMode`, `getScaleFactor` to `scaleFactor`, `getSystemTheme`
  to `systemTheme`, `getSystemInfo` to `systemInfo`.
- `Command.requestUserAttention` renamed to `Command.requestAttention`.
- `Command.createImage` and `Command.updateImage` no longer accept an
  overloaded pixel-buffer signature. Use `Command.createImageRgba` and
  `Command.updateImageRgba` for width/height/pixels calls; the
  `createImage(handle, data)` / `updateImage(handle, data)` forms are
  unchanged.
- `AppConfig.update` is now required. Apps that need no update logic
  supply a pass-through (`(state) => state`).
- `AppConfig.subscriptions` must return `Subscription[]`; the falsy
  union (`false | null | undefined`) is removed. Callers that want
  conditional subscriptions spell it out at the call site.
- `AppConfig.expectedExtensions` renamed to `AppConfig.requiredWidgets`.
- `Grid` prop `columns` renamed to `numColumns`.
- `Extension` type and `defineExtension` renamed to `NativeWidget` and
  `defineNativeWidget`; `CanvasWidget` renamed to `Widget`;
  `extensionConfig` in project config renamed to `nativeWidgetConfig`.
- Canvas, mouse area, pane, and sensor events unified into `WidgetEvent`.
  Events previously typed as `{ kind: "canvas" }`, `{ kind: "mouse_area" }`,
  `{ kind: "pane" }`, or `{ kind: "sensor" }` are now `{ kind: "widget" }`
  with a typed `type` string (`canvas_press`, `sensor_resize`,
  `mouse_right_press`, `pane_clicked`, etc.) and specialized fields in the
  `data` map. Type guards `isCanvas`, `isMouseArea`, `isPane`, `isSensor`
  still work but narrow to the new shape.
- `view` must return explicit `Window` nodes. Implicit window wrapping
  removed.
- `UndoStack.applyCommand` renamed to `UndoStack.push`.
- Renderer subscriptions (`Subscription.onKeyPress`, `onPointerMove`,
  etc.) no longer accept a tag parameter. Timer subscriptions keep their
  tag (required, appears in `TimerEvent`). The management key is now
  derived from `{type, windowId}` instead of `{type, tag}`.
- `Scrollable` `style` prop removed (was unused).

### Added

- `src/cli/cargo-plushie.ts` with `resolveCargoPlushie()` for
  locating the `cargo-plushie` build tool.
- `docs/reference/versioning.md` documenting the two-axis policy and
  the exact-match `PLUSHIE_RUST_VERSION` rule.
- Typed `Diagnostic` union decoding renderer diagnostic variants:
  `update_panicked`, `recovery_failed`, `chain_depth_exceeded`, and
  `protocol_version_mismatch`.
- Typed `SessionErrorEvent` (with `code` field) and `SessionClosedEvent`.
- Typed `RendererExit` event.
- `recovery_failed` event surfaced when the renderer cannot restart
  after a crash.
- Heartbeat watchdog: detects an unresponsive renderer and surfaces the
  failure through the normal error path.
- `Command.dispatch` chain depth cap; violations surface as a typed
  `ChainDepthExceededDiagnostic`.
- Wire message size cap on encode, surfaced as typed `BufferOverflowError`
  with the real byte count.
- `ProtocolVersionMismatchError` typed error on hello handshake mismatch,
  with `expected` and `got` fields.
- Typed `Span` interface and encoder for `rich_text` content.
- `link_click` event decoded as a typed `LinkClickEvent` variant.
- Pointer events gain `captured` and `lost` fields.
- Typed per-kind `EffectResult` variants for file dialog, clipboard, and
  notification effects.
- `linearGradientFromAngle` constructor in `plushie/canvas`.
- Named-color catalog exported from `plushie/ui`.
- `resolvedA11y` helper with builder defaults and validation projection.
- Scoped focus commands and `announce` politeness tiers (`polite`,
  `assertive`).
- A11y: scope-rewrite for refs, auto-populated `role`, implicit radio
  groups.
- Animation descriptors accepted on `pin.x`/`pin.y`,
  `svg.rotation`/`svg.opacity`, and `progress_bar.value`.
- Canvas `Layer` element with shape-to-wire-node conversion.
- Canvas `rect` per-corner radius via 4-element tuple.
- Window-scoped subscriptions: `windowId` option on renderer subscription
  constructors.
- `PLUSHIE_` prefix enforced on renderer env whitelist.
- `requiredWidgets` handshake routed through renderer diagnostic; the
  client-side pre-check is removed.
- `validateProps` function.
- Looping tweens via `loop()` descriptor.
- Max tree depth limit with typed error on violation.

### Fixed

- Protocol: `image_op` list and `clear` sent on typed channel;
  `default_font` encoded as `{family}` object; subscription, key, IME,
  and animation events decoded from `value` field; `load_font` emitted as
  typed binary message; window events decoded from top-level `value` field.
- Framing: `decodeLines` cap check now counts UTF-8 bytes (not UTF-16
  code units); `BufferOverflowError` thrown with real byte count on both
  encode and decode paths.
- Widget ID validation rejects empty, non-ASCII, hash-containing, and
  oversized IDs.
- Duplicate sibling IDs rejected during normalization.
- Coalescence key uses full scoped path, not local ID.
- Handler registration uses full wire event types.
- Pending async work fails cleanly when the renderer restarts.
- Effect stubs cleared on runtime reinit.
- Graceful shutdown timeout added to `SessionPool` and `SpawnTransport`.
- Clipboard `alt_text` emitted correctly on the wire.
- `encodePadding` repaired; `Alignment` narrowed to axis-split form.
- CLI uses static imports for `node:fs` and `node:path` builtins.
- Table auto-scoped row IDs use underscore separator.
- SEA binary extraction works on Windows.
- Socket transport address parsing is explicit; connection failures
  distinguished from session-level errors.
- Unknown top-level wire messages rejected rather than silently dropped.
- Animation descriptors validated at construction time.
- Canvas interact action names corrected.
- Hello handshake requires `protocol`, `version`, and `name` fields;
  version mismatch logged as a soft warning.
- Tree hash golden updates gated by test backend.
- Binary download hardened against transient failures.
- Popup active-descendant a11y warnings quieted for valid configurations.
- Radio builder aligned with widget opts shape.

### Changed

- `npx plushie build` shells out to `cargo plushie build` instead of
  generating its own Cargo workspace. Two install paths: `cargo install
  cargo-plushie --version <pin>` or `PLUSHIE_RUST_SOURCE_PATH` pointing
  at a plushie-rust checkout.
- Custom renderer binaries land in `bin/plushie-renderer`, unifying
  resolution for stock downloads and custom builds.

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

[0.6.0]: https://github.com/plushie-ui/plushie-typescript/releases/tag/v0.6.0
[0.5.0]: https://github.com/plushie-ui/plushie-typescript/releases/tag/v0.5.0
