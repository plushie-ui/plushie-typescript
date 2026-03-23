# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-03-23

Initial release of the plushie TypeScript SDK.

### Added

- **App framework** with inline pure-function event handlers and optional
  `update()` fallback. JSX and function API for widget construction.
  `DeepReadonly<M>` model type prevents accidental mutation.
- **38 widget builders** -- layout (column, row, container, scrollable,
  stack, overlay, grid, keyed_column, responsive, pin, floating),
  display (text, rich_text, markdown, image, svg, progress_bar, qr_code,
  rule, space), input (button, text_input, text_editor, checkbox, radio,
  toggler, slider, vertical_slider, pick_list, combo_box), complex
  (table, pane_grid, tooltip, mouse_area, sensor, themer, window, canvas).
- **Canvas shape system** with shape primitives (rect, circle, line, text,
  path, image, svg, group), path commands, transforms, clips, stroke
  builder, interactive shapes with drag support, and linear gradients.
- **Full wire protocol** implementation for MessagePack (4-byte
  length-prefixed) and JSON (newline-delimited) formats. All outgoing
  message types (settings, snapshot, patch, subscribe, unsubscribe,
  widget_op, window_op, effect, image_op, extension_command, query,
  interact, tree_hash, screenshot, reset, advance_frame) and all
  incoming message types (hello, event, effect_response,
  query_response, interact_step, interact_response, tree_hash_response,
  screenshot_response, reset_response, session_error, session_closed).
- **Tree normalization** with scoped IDs (named containers prefix
  children), auto-ID detection, a11y reference resolution, and
  duplicate sibling ID warnings.
- **Incremental tree diffing** with patch generation (replace_node,
  update_props, insert_child, remove_child). O(n) reorder detection.
- **Coalescable event buffering** for high-frequency events (mouse
  moved, sensor resize) via queueMicrotask.
- **Command system** -- async (with AbortSignal), stream
  (AsyncIterable), cancel, sendAfter, batch, exit, focus, scroll,
  select, cursor, announce, window ops, image ops, pane ops, extension
  commands, queries, effects.
- **Subscription lifecycle** with key-based diffing, max_rate change
  detection, and timer management via re-arming setTimeout.
- **Three-tier testing framework** (mock, headless, windowed) via real
  plushie binary. Session pool for multiplexed test sessions. Helpers:
  click, typeText, submit, toggle, select, slide, press, release,
  typeKey, moveTo, scroll, paste, sort, find, findByText, findByRole,
  findByLabel, findFocused, queryTree, model, tree, assertText,
  assertExists, assertNotExists, awaitAsync, treeHash, screenshot.
- **Platform effects** -- file dialogs, clipboard, notifications with
  per-kind timeouts.
- **State helpers** -- animation (8 easing functions), selection
  (single/multi/range), undo/redo with coalescing, navigation routing,
  data query pipeline (filter, search, sort, paginate).
- **WASM renderer support** via WasmTransport for browser deployment.
- **Node.js SEA** (Single Executable Application) bundling support.
- **Unix socket and TCP transport** via SocketTransport for remote
  rendering.
- **Dev server** with file watching and debounced reload. Model
  preserved across reloads.
- **Extension widget system** with container support, command
  generation, and Cargo workspace scaffolding for native Rust
  extensions.
- **.plushie script** parser and runner for automated testing and
  replay.
- **Binary download** from GitHub releases with SHA256 verification
  and architecture validation.
- **Renderer restart** with exponential backoff (100ms base, 5s max).
- **CLI** -- download, build, dev, run, stdio, inspect, connect,
  script, replay commands.
- **Postinstall binary download** -- binary is downloaded automatically
  on `npm install`. Set `PLUSHIE_SKIP_DOWNLOAD=1` to disable.

[0.1.0]: https://github.com/plushie-ui/plushie-typescript/releases/tag/v0.1.0
