# Introduction

## What is Plushie?

Plushie is a native desktop GUI platform with SDKs for multiple
languages. This guide covers the TypeScript SDK.

When you build an app with Plushie, you get real native windows. Not
Electron, not a web view, not a browser packaged as a desktop app. Your
application is a Node.js process that owns all the state. A separate
Rust binary handles rendering, input, and platform integration.

The renderer is built on [Iced](https://github.com/iced-rs/iced), a
cross-platform GUI toolkit for Rust. It provides GPU-accelerated
rendering, a software fallback for headless environments, and full
accessibility support including keyboard navigation and screen reader
integration. You never interact with Iced directly. Plushie handles the
communication, and you write everything in TypeScript.

## The Elm architecture

Plushie follows the Elm architecture, a pattern for building UIs around
one-way data flow. If you have used Elm, Redux, or a reducer-based React
app, the shape will feel familiar. It is the same model/update/view cycle,
just running on the desktop instead of the browser.

There are three pieces:

**Model** - your application state. It can be any TypeScript value: an
interface, a tuple, a single number, a discriminated union. Plushie does
not impose a schema. Whatever your `init` callback returns becomes the
initial model, and the `App<M>` type carries that through the runtime as
`DeepReadonly<M>`.

**Update and inline handlers** - the functions that receive the current
model and an event, then return the next model (or a `[model, command]`
tuple). Widget events (clicks, inputs, toggles) route through inline
handlers on the widget prop. Everything else (timers, async results,
window events, system events) routes through a single `update` fallback.
Both shapes are pure functions of the existing state and the event.

**View** - a function that takes the current model and returns a tree
of top-level windows describing what should be on screen. The runtime
calls `view` after every successful update. You never mutate the UI
directly; you return a description of what the screen should look like.
A single-window app returns one window. Returning no windows closes
every window and shuts the app down cleanly.

The cycle looks like this:

    event -> handler / update -> new model -> view -> UI tree -> render

This is the entire control flow. Events go in, state comes out, the view
reflects it. There is no two-way binding and no hidden mutation. When
something looks wrong on screen, you look at the model. When the model is
wrong, you look at the event that changed it. Every bug has a short
trail.

Plushie also supports [subscriptions](../reference/subscriptions.md),
declarative specs for ongoing event sources like timers, keyboard
shortcuts, and window events. Your app declares which subscriptions
are active based on the current model, and the runtime starts and
stops them automatically. One-off side effects (HTTP fetches, file
dialogs, clipboard writes, window operations) are expressed as
[commands](../reference/commands.md) returned from a handler. The
runtime executes them and feeds results back as events.

This architecture makes your application predictable and testable. You
can test your entire UI through the real renderer binary without
mocking anything; see the [testing reference](../reference/testing.md)
for the Vitest integration.

## How it works

Your TypeScript application and the renderer run as two OS processes
that exchange messages over stdio by default. Other transports are
available for remote, embedded, and browser scenarios.

Your application builds UI trees with the dual JSX and function API in
`plushie/ui`. The runtime manages the model and runs the update/view
cycle. When `view` produces a new tree, the runtime diffs it against
the previous one and sends only the changes to the renderer over a
wire protocol (MessagePack by default, with a JSON option for
debugging). See the [wire protocol reference](../reference/wire-protocol.md).

The renderer receives patches, updates its internal widget tree, and
renders frames. When the user interacts with the UI (clicking a button,
typing in an input, resizing a window), the renderer sends
[events](../reference/events.md) back over the same connection. The
runtime decodes them, dispatches to the matching inline handler or to
`update`, and the cycle continues.

The two-process split gives you resilience. If the renderer crashes,
Plushie restarts it and re-syncs your application state. Your model is
never lost. If a handler throws, the runtime catches it, logs the error,
and keeps the previous state. Neither process can take the other down.

Because the two processes communicate over a byte stream, they do not
need to run on the same machine. Your TypeScript application can run on a
server or an embedded device with no display and no GPU. The renderer
runs wherever there is a screen. This is how you build desktop UIs for
headless infrastructure, remote sessions over SSH, or IoT devices.

## Where Plushie runs

The TypeScript SDK targets three environments from a single codebase:

- **Node.js desktop.** The default. Your app is a Node process that
  spawns the renderer binary over stdio. This is what you run during
  development and what most production deployments ship.
- **Browser via WASM.** The renderer is also published as a WebAssembly
  module. Your app and the renderer run together in the browser tab,
  exchanging the same MessagePack messages over an in-process channel
  instead of stdio. No server is needed for the UI layer. See
  [JSX and bundlers](../reference/jsx-and-bundlers.md).
- **Single-executable bundles.** Node's SEA support lets you ship your
  app and the renderer binary as one file per platform, with no Node
  runtime to install on the target machine. See
  [CLI commands](../reference/cli-commands.md).

The same source tree runs in all three. You pick the target at build
time.

## Why TypeScript

The SDK exposes a dual surface: a JSX form for declarative UI trees and
a function form for programmatic construction. Both emit the same wire
nodes and can be mixed freely inside one view. See
[JSX and functions](../reference/jsx-and-functions.md) for the details.

Types are load-bearing. `App<M>`, `Command<M>`, and `Subscription<M>`
flow your model type through every handler; `DeepReadonly<M>` enforces
spread-based updates; event guards like `isClick`, `isTimer`, and
`isAsync` narrow a discriminated `Event` union to the exact variant.
The type system catches the mistakes that would otherwise surface as
runtime bugs after a frame or two.

Beyond the API, picking TypeScript means fitting in with the rest of
the ecosystem: your bundler, your linting, your build pipeline, and the
npm packages you already depend on.

## What you can build

Plushie is a general-purpose desktop toolkit:

- **Desktop tools and utilities**: file managers, text editors, system
  monitors, anything you would reach for a native toolkit for.
- **Dashboards and data visualization**: connect to your TypeScript or
  Node backend directly, no API layer needed. The
  [built-in widget catalog](../reference/built-in-widgets.md) covers
  tables, progress bars, input controls, and canvas-driven charts.
- **Creative applications**: the [canvas](../reference/canvas.md) system
  supports custom 2D drawing with shapes, paths, transforms, and
  interactive elements.
- **Multi-window applications**: your `view` returns a list of windows,
  each with its own layout, managed from a single model. See the
  [windows and layout reference](../reference/windows-and-layout.md).
- **Reusable widget libraries**: compose existing widgets in pure
  TypeScript, draw fully custom visuals with the canvas, or write
  Rust-backed [custom widgets](../reference/custom-widgets.md) when you
  need custom GPU rendering.
- **Browser apps that feel native**: ship the same code as a WASM bundle
  and render inside a tab with no DOM involved.
- **Remote rendering**: run your logic on a server or embedded device
  and render on a local display over SSH, as described above.

## What we will build in this guide

Throughout these chapters, we will build **Plushie Pad**, a live widget
editor for experimenting with the Plushie API. The project lives at
`~/projects/plushie-demos/typescript/plushie_pad/` and is the anchor
project from chapter 3 onward.

The finished application has two panes. On the left, you write Plushie
widget code. On the right, you see it rendered in real time. An event
log at the bottom shows every event that fires as you interact with
the rendered output. Each chapter adds a feature: events, layout,
styling, animation, subscriptions, canvas drawing, custom widgets,
testing, and more.

Plushie supports hot reloading during development. Keep the pad
running as you work through the guide. Each chapter adds a new
capability, and you will see it appear the moment you save.

## How these guides are organized

The guides are sequential. Chapter 2 sets up your environment and
scaffolds the first app. Chapter 3 introduces Plushie Pad, and the pad
threads through every chapter after that. Each chapter links to the
relevant reference pages in [`docs/reference/`](../reference/), which
are the source of truth for every prop, event variant, command, and
subscription constructor.

Let's get started.

---

Next: [Getting Started](02-getting-started.md)
