# Documentation

## Guides

Sequential chapters that build on each other. Start here if you're
new to Plushie.

1. [Introduction](guides/01-introduction.md) - what Plushie is and how it works
2. [Getting Started](guides/02-getting-started.md) - installation, binary setup, first run
3. [Your First App](guides/03-your-first-app.md) - building a counter with the Elm architecture
4. [The Development Loop](guides/04-the-development-loop.md) - hot reload, debugging
5. [Events](guides/05-events.md) - widget events, keyboard, pointer, type guards
6. [Lists and Inputs](guides/06-lists-and-inputs.md) - dynamic lists, text inputs, forms
7. [Layout](guides/07-layout.md) - rows, columns, containers, responsive sizing
8. [Styling](guides/08-styling.md) - themes, colors, fonts, per-widget style overrides
9. [Animation and Transitions](guides/09-animation.md) - transitions, springs, tweens, easing
10. [Subscriptions](guides/10-subscriptions.md) - timers, global key/pointer events, window events
11. [Async and Effects](guides/11-async-and-effects.md) - tasks, streams, platform effects
12. [Canvas](guides/12-canvas.md) - shapes, layers, transforms, interactive elements
13. [Custom Widgets](guides/13-custom-widgets.md) - composing widgets, canvas widgets, native Rust widgets
14. [State Management](guides/14-state-management.md) - routing, undo/redo, selection, data pipelines
15. [Testing](guides/15-testing.md) - test framework, backends, selectors, screenshots
16. [Shared State](guides/16-shared-state.md) - multi-session apps over SSH
17. [Browser Deployment](guides/17-browser-deployment.md) - WASM renderer, Node SEA, bundler integration

## Reference

Lookup material organized by topic. Each page is self-contained.

- [Accessibility](reference/accessibility.md) - AccessKit integration, roles, labels, keyboard navigation
- [Animation](reference/animation.md) - transitions, springs, sequences, easing curves, animatable props
- [App Lifecycle](reference/app-lifecycle.md) - init/update/view callbacks, event dispatch, renderer restart
- [Built-in Widgets](reference/built-in-widgets.md) - every widget with props, events, and examples
- [Canvas](reference/canvas.md) - shapes, layers, groups, transforms, clips, gradients
- [CLI Commands](reference/cli-commands.md) - download, build, dev, run, stdio, inspect, script, replay
- [Commands](reference/commands.md) - async, focus, scroll, window ops, platform effects
- [Composition Patterns](reference/composition-patterns.md) - reusable components, overlays, context menus, multi-window
- [Configuration](reference/configuration.md) - application config, environment variables, settings
- [Custom Widgets](reference/custom-widgets.md) - WidgetDef, native widgets, registration, commands
- [Events](reference/events.md) - event types, fields, type guards, inline handlers vs update
- [JSX and Bundlers](reference/jsx-and-bundlers.md) - tsconfig, pragma, bundler integration, WASM, Node SEA
- [JSX and Functions](reference/jsx-and-functions.md) - the dual API, children, handler dispatch
- [Scoped IDs](reference/scoped-ids.md) - ID scoping rules, scope matching, command paths
- [Standalone Packaging](reference/standalone-packaging.md) - SEA host payloads wrapped by the shared Rust launcher
- [Subscriptions](reference/subscriptions.md) - timer, keyboard, pointer, window, catch-all subscriptions
- [Testing](reference/testing.md) - test sessions, backends, helpers, screenshots, scripts
- [Themes and Styling](reference/themes-and-styling.md) - built-in themes, custom palettes, style maps
- [Versioning](reference/versioning.md) - SDK version, pinned renderer, protocol version
- [Windows and Layout](reference/windows-and-layout.md) - window props, sizing, pane grids, multi-window
- [Wire Protocol](reference/wire-protocol.md) - MessagePack/JSON framing, message types, transport modes

## Other resources

- [Examples](https://github.com/plushie-ui/plushie-typescript/tree/main/examples) - example apps included in the repo
- [Changelog](../CHANGELOG.md) - version history and migration notes
- [Demo apps](https://github.com/plushie-ui/plushie-demos/tree/main/typescript) - multi-file projects with custom widgets and real scaffolding
