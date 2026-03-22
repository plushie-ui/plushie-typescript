# Changelog

## 0.1.0

Initial release of the plushie TypeScript SDK.

### Features

- Native desktop GUI framework communicating with the plushie Rust renderer
- 38 widget builders with JSX and function API support
- Canvas shape system with interactive shapes, transforms, gradients
- Full wire protocol implementation (MessagePack and JSON)
- Tree normalization with scoped IDs and incremental diffing
- Inline pure-function event handlers with optional update() fallback
- Complete command system (async, window ops, effects, images, panes, extensions)
- Subscription lifecycle management with key-based diffing
- Three-tier testing framework (mock, headless, windowed) via real binary
- Platform effects (file dialogs, clipboard, notifications)
- State helpers: animation, selection, undo/redo, routing, data queries
- WASM renderer support
- Node.js SEA (Single Executable Application) bundling support
- Dev server with file watching and debounced reload
- Extension widget system
- 7 example apps (counter, clock, todo, async_fetch, shortcuts, notes, color_picker)
