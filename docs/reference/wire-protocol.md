# Wire Protocol

The wire protocol defines the message format between the TypeScript
SDK and the Plushie renderer. The protocol is language-agnostic and
shared across all Plushie SDKs. This reference covers the TypeScript
perspective: how the SDK encodes outgoing messages, decodes incoming
ones, and manages the handshake, session, and framing lifecycle.

Encoders, decoders, `PROTOCOL_VERSION`, and `helloWidgetCapabilities`
live in `plushie/client` (source: `src/client/protocol.ts`). Framing
primitives live in `src/client/framing.ts`. Transports live in
`src/client/transport.ts` (`SpawnTransport`, `StdioTransport`) and
`src/client/wasm_transport.ts` (`WasmTransport`).

For the complete cross-SDK message specification, see the
[Renderer Protocol Spec](https://github.com/plushie-ui/plushie-rust/blob/main/docs/protocol.md).

## Wire formats

Two formats carry the same message structures. The format is selected
via the `format` option on `SpawnTransport`, `StdioTransport`, or the
pool, and is surfaced as the `WireFormat` type:

```typescript
import type { WireFormat } from "plushie/client"
// type WireFormat = "msgpack" | "json"
```

### MessagePack (default)

Each message is prefixed with a 4-byte big-endian unsigned integer
indicating the payload size:

```
[4 bytes: size as u32 BE][payload bytes]
```

The SDK frames with `encodePacket` and parses with `decodePackets`
from `plushie/client`. Transports accumulate raw bytes and drain
complete frames as they arrive; leftover bytes stay in the buffer
until the next read.

MessagePack is more compact for binary payloads (image bytes, RGBA
screenshots) and reduces parsing overhead for high update rates.

### JSON (JSONL)

Each message is a single JSON object terminated by `\n`. Messages
must not contain embedded newlines. The SDK frames with `encodeLine`
and parses with `decodeLines`.

JSON is human-readable and is the only format supported in the
browser via `WasmTransport`. To run the native binary in JSON mode,
pass `format: "json"` to the transport; the SDK appends `--json` to
the CLI invocation automatically.

### Maximum message size

Both directions cap individual frames at 64 MiB
(`MAX_MESSAGE_SIZE` in `framing.ts`). A frame over the cap raises
`BufferOverflowError`:

```typescript
import { BufferOverflowError } from "plushie/client"

try {
  transport.send(msg)
} catch (err) {
  if (err instanceof BufferOverflowError) {
    console.error(`frame ${err.size} exceeds ${err.limit}`)
  }
}
```

`BufferOverflowError` fires on both encode and decode paths. On
decode, the transport clears the offending buffer and logs a
defensive warning rather than deadlocking the read loop. For
JSONL framing the cap is measured in UTF-8 bytes (via
`utf8ByteLength`) to match the renderer's byte-count semantics.

## Protocol version

The current protocol version is `1`:

```typescript
import { PROTOCOL_VERSION } from "plushie/client"
```

The SDK sends `PROTOCOL_VERSION` inside every `settings` message
and validates the renderer's `hello` reply against it. A mismatch
raises `ProtocolVersionMismatchError` from the session connect
promise:

```typescript
import { ProtocolVersionMismatchError } from "plushie/client"

try {
  await session.connect({ settings })
} catch (err) {
  if (err instanceof ProtocolVersionMismatchError) {
    console.error(`SDK expects ${err.expected}, got ${err.got}`)
  }
}
```

The error carries `expected` and `got` numeric fields so callers
can handle the mismatch without parsing the message.

## Startup handshake

The SDK and renderer follow a fixed sequence:

1. **SDK sends `settings`** with `protocol_version` plus the app's
   settings merged in. `encodeSettings(session, settings)` wraps
   user settings under the outer `settings` key:
   `{ type: "settings", session, settings: { protocol_version, ... } }`.
   Socket-auth tokens are represented as `settings.token_sha256`,
   not as plaintext `token`.
   If the app passes `requiredWidgets`, the native widget keys are
   forwarded under `settings.required_widgets` for the renderer to
   validate against its registry.
2. **Renderer auto-detects format** from the first byte of stdin
   and parses the settings.
3. **Renderer sends `hello`** advertising its own protocol version,
   mode, backend, transport, registered widgets, and extensions.
   Decoded to `HelloInfo`:

```typescript
interface HelloInfo {
  readonly protocol: number
  readonly protocol_version: number
  readonly version: string
  readonly name: string
  readonly mode: "windowed" | "headless" | "mock"
  readonly backend: string
  readonly transport: string
  readonly extensions: readonly string[]
  readonly native_widgets: readonly string[]
  readonly widgets: readonly string[]
  readonly widget_sets: readonly string[]
}
```

`helloWidgetCapabilities(info)` returns a deduplicated union of
`native_widgets`, `widgets`, and `extensions` for callers that need
a single capability list.

4. **SDK validates `protocol` against `PROTOCOL_VERSION`** and
   resolves `Session.connect`. A binary-version skew warns on
   stderr but does not abort; the binary version is compared against
   `PLUSHIE_RUST_VERSION` from `plushie/client`.
5. **Normal traffic begins.** The SDK sends an initial `snapshot`,
   then `patch` messages for subsequent view changes. Events and
   diagnostics stream back asynchronously.

## Outgoing messages (SDK to renderer)

All outgoing encoders are exported from `plushie/client` and return
plain `WireMessage` objects (`Record<string, unknown>`). Every
message carries a top-level `session` field, which the SDK injects
automatically via `Session.send` if the caller omits it.

| Encoder | Wire `type` | Purpose |
|---|---|---|
| `encodeSettings` | `settings` | Startup configuration, protocol version, required widgets |
| `encodeSnapshot` | `snapshot` | Full tree replacement |
| `encodePatch` | `patch` | Incremental tree update with op list |
| `encodeSubscribe` | `subscribe` | Register a subscription by kind and tag |
| `encodeUnsubscribe` | `unsubscribe` | Remove a subscription |
| `encodeCommand` | `command` | Single widget-targeted command |
| `encodeCommands` | `commands` | Batch of widget-targeted commands |
| `encodeWidgetOp` | `widget_op` | Native widget op |
| `encodeWindowOp` | `window_op` | Window op (close, resize, move, ...) |
| `encodeSystemOp` | `system_op` | System-level op |
| `encodeSystemQuery` | `system_query` | System state query |
| `encodeImageOp` | `image_op` | Image load/update/unload |
| `encodeEffect` | `effect` | File dialog, clipboard, notification request |
| `encodeQuery` | `query` | Find or tree dump query |
| `encodeInteract` | `interact` | Simulated input sequence (testing) |
| `encodeTreeHash` | `tree_hash` | Structural hash request |
| `encodeScreenshot` | `screenshot` | Pixel capture request |
| `encodeReset` | `reset` | Reset a session |
| `encodeRegisterEffectStub` | `register_effect_stub` | Install effect stub |
| `encodeUnregisterEffectStub` | `unregister_effect_stub` | Remove effect stub |
| `encodeAdvanceFrame` | `advance_frame` | Manual frame clock advance |

Patch operations (produced by `encodePatch`) are one of four shapes:

```typescript
type WirePatchOp =
  | { op: "replace_node"; path: number[]; node: WireMessage }
  | { op: "update_props"; path: number[]; props: WireMessage }
  | { op: "insert_child"; path: number[]; index: number; node: WireMessage }
  | { op: "remove_child"; path: number[]; index: number }
```

The `path` is always an integer array of child indices, never a
string ID. Tree nodes serialize with `id`, `type`, `props`, and
`children` keys; the `kind` on a `UINode` maps to `type` on the
wire.

## Encoding: camelCase to snake_case

TypeScript source uses camelCase at the call site; the wire uses
snake_case. Widget builders do the translation manually, prop by
prop, using `putIf(result, value, "wire_key", encoder)` from
`src/ui/build.ts`:

```typescript
import { putIf } from "../build"
import { encodeLength, encodePadding } from "../types"

putIf(p, clean.width, "width", encodeLength)
putIf(p, clean.height, "height", encodeLength)
putIf(p, clean.padding, "padding", encodePadding)
putIf(p, clean.textSize, "text_size")
putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
```

`putIf` skips `undefined` values, so omitted props never appear on
the wire. The optional encoder argument runs a typed conversion
(`encodeColor`, `encodeFont`, `encodeStyleMap`, `encodeA11y`,
`encodeGradient`, `encodeShadow`, `encodeValidation`, and so on
from `src/ui/types.ts`) before assigning to the output.

Handler props (`onClick`, `onInput`, `onToggle`, ...) are extracted
separately via `extractHandlers` and registered on the handler map;
they never appear on the wire. The renderer only sees the event
types (`click`, `input`, `toggle`).

Notable renames applied by the widget builders include:

| camelCase prop | Wire field |
|---|---|
| `maxWidth`, `minWidth`, `maxHeight`, `minHeight` | `max_width`, `min_width`, `max_height`, `min_height` |
| `alignX`, `alignY` | `align_x`, `align_y` |
| `eventRate` | `event_rate` |
| `contentFit` | `content_fit` |
| `lineHeight`, `textSize` | `line_height`, `text_size` |
| `selectionColor`, `placeholderColor` | `selection_color`, `placeholder_color` |
| `inputPurpose` | `input_purpose` |
| `menuHeight`, `menuStyle` | `menu_height`, `menu_style` |
| `arrowMode` | `arrow_mode` |
| `onLinkClick`, `onKeyBinding`, `onOptionHovered` | wire event types `link_click`, `key_binding`, `option_hovered` |
| `onPaneResized`, `onPaneDragged`, `onPaneClicked`, `onPaneFocusCycle` | `pane_resized`, `pane_dragged`, `pane_clicked`, `pane_focus_cycle` |

Outgoing messages from the `_op` envelopes (`widget_op`, `window_op`,
`system_op`, `system_query`, `image_op`) place op-specific data under
a nested `payload` object. Addressing fields (`window_id`, `op`)
stay flat beside the envelope's `type`.

## Incoming messages (renderer to SDK)

`decodeMessage(raw)` from `plushie/client` classifies a
deserialized wire object into a `DecodedResponse` discriminated
union. Unknown top-level types throw; the SDK assumes lock-step
versioning with the renderer rather than silently forwarding
malformed payloads.

| `type` field | Decoded as |
|---|---|
| `hello` | `{ type: "hello"; data: HelloInfo }` |
| `event` | `{ type: "event"; data: Event }` |
| `diagnostic` | `{ type: "diagnostic"; data: DiagnosticMessage }` |
| `effect_response` | `{ type: "effect_response"; id; status; result; error }` |
| `query_response` | `{ type: "query_response"; id; target; data }` |
| `op_query_response` | `{ type: "op_query_response"; kind; tag; data }` |
| `interact_step` | `{ type: "interact_step"; id; events }` |
| `interact_response` | `{ type: "interact_response"; id; events }` |
| `tree_hash_response` | `{ type: "tree_hash_response"; id; name; hash }` |
| `screenshot_response` | `{ type: "screenshot_response"; id; name; hash; width; height; rgba }` |
| `reset_response` | `{ type: "reset_response"; id; status }` |
| `effect_stub_register_ack` | `{ type: "effect_stub_register_ack"; kind }` |
| `effect_stub_unregister_ack` | `{ type: "effect_stub_unregister_ack"; kind }` |

`decodeEvent` dispatches on the inbound `family` field and returns
one of the typed `Event` variants from `plushie`: `WidgetEvent`,
`KeyEvent`, `ModifiersEvent`, `ImeEvent`, `WindowEvent`,
`SystemEvent`, `WidgetCommandErrorEvent`, `SessionErrorEvent`, or
`SessionClosedEvent`. Families include the widget event set
(`click`, `input`, `submit`, `toggle`, `select`, `slide`,
`slide_release`, `press`, `release`, `move`, `scroll`, `enter`,
`exit`, `drag`, `drag_end`, `focused`, `blurred`, `scrolled`,
`resize`, `double_click`, `status`, `sort`, `paste`,
`option_hovered`, `open`, `close`, `key_binding`, `link_click`,
`transition_complete`, `pane_*`, `diagnostic`), IME families
(`ime_opened`, `ime_preedit`, `ime_commit`, `ime_closed`), window
families (`window_opened`, `window_closed`, `window_moved`,
`window_resized`, `window_focused`, `window_unfocused`,
`window_rescaled`, `window_close_requested`, `file_hovered`,
`file_dropped`, `files_hovered_left`), and subscription pointer
families (`cursor_moved`, `cursor_entered`, `cursor_left`,
`button_pressed`, `button_released`, `wheel_scrolled`,
`finger_pressed`, `finger_moved`, `finger_lifted`, `finger_lost`)
which are converted to unified `WidgetEvent` shapes.

`key_press` and `key_release` dispatch by `id`: a non-empty `id`
produces a scoped `WidgetEvent`, an empty `id` produces a global
`KeyEvent`.

Scoped wire IDs (`window#scope/leaf`) are split by `splitScopedId`
into `{ id, scope, windowId }`. The function reverses the scope
chain so the innermost ancestor is first.

## Effects

An effect is a platform-side request: file dialog, clipboard
access, or desktop notification. The SDK sends an `effect` message
with an `id`, a `kind` string (`file_open`, `clipboard_read_html`,
`notification`, ...), and a `payload`. The renderer replies with
an `effect_response` carrying `status` (`ok`, `cancelled`,
`unsupported`, `error`), a `result` payload on success, and an
`error` string on failure.

The runtime matches the response `id` back to the original
`(tag, effectKind)` and calls `decodeEffectResult(effectKind,
status, result, error)` from `src/types.ts`. The typed result
reaches the app as an `EffectEvent` with a discriminated `result`
field:

```typescript
if (isEffect(event, "import")) {
  if (event.result.kind === "file_opened") {
    return loadFile(state, event.result.path)
  }
  if (event.result.kind === "cancelled") return state
  if (event.result.kind === "error") {
    return { ...state, error: event.result.message }
  }
}
```

`EffectResult` covers the success variants per effect kind
(`file_opened`, `files_opened`, `file_saved`, `directory_selected`,
`directories_selected`, `clipboard_text`, `clipboard_html`,
`clipboard_written`, `clipboard_cleared`, `notification_shown`)
and the common non-success variants (`cancelled`, `timeout`,
`error`, `unsupported`, `renderer_restarted`). The
`renderer_restarted` variant is synthesized by the SDK when an
in-flight effect is cut short by a renderer crash and restart.

## Diagnostics

The renderer emits a top-level `diagnostic` message for conditions
that warrant structured reporting but don't belong inside an
event: duplicate IDs, prop range violations, widget panics,
content-length overflows, and so on.

```typescript
interface DiagnosticMessage {
  readonly session: string
  readonly level: "info" | "warn" | "error"
  readonly diagnostic: Diagnostic
}
```

`Diagnostic` is a discriminated union over `kind`. Apps narrow
on `kind` to read variant-specific fields:

```typescript
if (msg.diagnostic.kind === "duplicate_id") {
  console.warn(`duplicate id: ${msg.diagnostic.id}`)
} else if (msg.diagnostic.kind === "prop_range_exceeded") {
  const { prop, raw, clamped } = msg.diagnostic
  console.warn(`${prop}: ${raw} clamped to ${clamped}`)
}
```

Known diagnostic kinds include `duplicate_id`, `empty_id`,
`multiple_top_level_windows`, `unknown_window`,
`unrecognized_widget_placeholder`, `tree_depth_exceeded`,
`too_many_duplicates`, `widget_id_invalid`,
`missing_accessible_name`, `a11y_ref_unresolved`,
`prop_range_exceeded`, `prop_type_mismatch`, `prop_unknown`,
`content_length_exceeded`, `font_cache_cap_exceeded`,
`font_cap_exceeded`, `font_family_not_found`, `invalid_settings`,
`required_widgets_missing`, `widget_panic`, `svg_parse_error`,
`svg_decode_timeout`, `dash_cache_cap_exceeded`,
`emitter_coalesce_cap_exceeded`, `widget_id_type_collision`,
`view_panicked`, `update_panicked`, `unknown_message_type`,
`dispatch_loop_exceeded`, `buffer_overflow`. A kind not in this
set raises from `decodeMessage`; SDK and renderer are expected to
ship in lock-step.

Diagnostics are also mirrored to the renderer's log channel for
tools that consume stderr.

## Sessions

Every outbound message carries a `session` field, and every
inbound event carries a `session` field. In single-session mode
the field is an empty string (`""`) and the runtime ignores it.

When the renderer is launched with `--max-sessions > 1` (for
example, the test session pool), each transport holds its own
session ID and routes messages accordingly. `Session.send`
injects the session on every outbound message via
`transport.send({ session: this.sessionId, ...msg })`. The
`SessionPool` in `src/client/pool.ts` multiplexes many sessions
onto one `plushie --mock --max-sessions N` child process.

Two event families signal session lifecycle in multiplexed mode:

```typescript
if (event.kind === "session_error") {
  // event.code: "session_panic", "max_sessions_reached",
  // "session_channel_closed", "writer_dead", "font_cap_exceeded",
  // "renderer_panic", "session_reset_in_progress",
  // "session_backpressure_overflow"
  console.error(`session ${event.session}: ${event.code}`)
}

if (event.kind === "session_closed") {
  console.log(`session ${event.session} closed: ${event.reason}`)
}
```

`session_error` carries a stable `code` for programmatic matching
plus a human-readable `error` string. `session_closed` arrives
after a `reset` completes and the session thread exits.

## WASM transport

`WasmTransport` from `plushie/client` runs the renderer as a WASM
module in the same JavaScript context. Because the WASM module's
surface is a pair of JSON string callbacks, the wire format is
fixed to JSON: `format` is hard-coded to `"json"` and there is no
length-prefix framing. Messages are passed whole via
`app.send_message(json)`; events arrive as complete JSON strings
through the constructor callback.

```typescript
import init, { PlushieApp } from "plushie-wasm"
import { WasmTransport } from "plushie/client"

await init()
const transport = new WasmTransport(PlushieApp, { settings: {} })
```

The protocol semantics (message types, event families, effect
responses, diagnostics) are identical to the native transports.
`PROTOCOL_VERSION` is still sent inside the constructor's initial
settings payload. msgpack is not supported in WASM.

## See also

- [Commands reference](commands.md)
- [Events reference](events.md)
- [Subscriptions reference](subscriptions.md)
- [App lifecycle](app-lifecycle.md)
- [Built-in widgets](built-in-widgets.md)
