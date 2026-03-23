# Changelog

## 0.1.0

Initial release of the plushie TypeScript SDK.

### Features

- Native desktop GUI framework communicating with the plushie Rust renderer
- 38 widget builders with JSX and function API support
- Canvas shape system with interactive shapes, transforms, gradients
- Full wire protocol implementation (MessagePack and JSON)
- Tree normalization with scoped IDs and incremental diffing
- Coalescable event buffering (mouse moved, sensor resize)
- Inline pure-function event handlers with optional update() fallback
- Complete command system (async, window ops, effects, images, panes, extensions)
- Subscription lifecycle management with key-based diffing and max_rate updates
- Three-tier testing framework (mock, headless, windowed) via real binary
- Platform effects (file dialogs, clipboard, notifications) with timeouts
- State helpers: animation (8 easing functions), selection, undo/redo, routing, data queries
- WASM renderer support with WasmTransport for browser deployment
- Node.js SEA (Single Executable Application) bundling support
- Unix socket and TCP transport (SocketTransport) for remote rendering
- Dev server with file watching and debounced reload
- Extension widget system with container support and command generation
- .plushie script parser and runner for automated testing
- Binary download from GitHub releases with SHA256 verification
- Architecture validation via file command
- Renderer restart with exponential backoff (100ms base, 5s max, 5 retries)
- A11y ID reference resolution during tree normalization
- Window config callback with per-window prop diffing
- 7 example apps (counter, clock, todo, async_fetch, shortcuts, notes, color_picker)

### CLI commands

- `plushie download` -- download precompiled binary (with --wasm support)
- `plushie build` -- build from Rust source (with --wasm, --release)
- `plushie dev <app>` -- run with hot reload via tsx
- `plushie run <app>` -- run without watching
- `plushie stdio <app>` -- stdio transport for plushie --exec
- `plushie inspect <app>` -- print initial UI tree as JSON
- `plushie connect <addr>` -- connect to plushie --listen instance
- `plushie script` -- run .plushie test scripts
- `plushie replay <file>` -- replay scripts with real windows
