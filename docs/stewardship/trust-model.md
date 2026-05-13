# Trust model

What plushie-typescript's role is in the wider Plushie trust model,
what it implements on its own side, and where the broader picture
lives. The authoritative trust-model doc lives in plushie-rust
(`docs/stewardship/trust-model.md`); this doc describes the host
SDK's half.

## The asymmetric model

Plushie's wire boundary is asymmetric:

- **Renderer-to-host.** Closed and typed. The renderer can only
  push the fixed enumeration of event variants and structured
  responses defined by the wire protocol. There is no opaque-blob
  path, no string-eval, no generic "run this on the host"
  instruction. The host is therefore structurally protected from a
  compromised or malicious renderer. The remote-rendering use case
  relies on this.
- **Host-to-renderer.** Broader by design. The host asks the
  renderer to load fonts and images by path, render screenshots,
  exercise effects (clipboard, file dialogs, notifications), spawn
  subprocesses through structured renderer exec args. A compromised host can drive the
  full operation set against the user's machine wherever the
  renderer runs. Bounding this is the capability-manifest direction
  in plushie-rust's roadmap, not current work.

plushie-typescript is on the trusted side of this boundary. The
runtime, the transport, the widget builders, and user code all run
as the host. Concerns that frame the host as adversary are out of
scope under the current model.

## What plushie-typescript implements on its side

Renderer-to-host integrity depends on the host SDK actually holding
up the closed-shape contract on the receiving end.
plushie-typescript's load-bearing pieces:

- **Typed event decoding.** `decodeMessage` in `client/protocol.ts`
  parses incoming messages against the fixed event variant set.
  Unknown variants are rejected. They are not silently forwarded to
  user code as opaque maps. An unsafe decoder that passes through
  arbitrary shapes would undermine the host-protection claim.
- **Effect and query response correlation.** Effect commands and
  window queries get an internal wire ID and a timeout. Responses
  are routed back to the originating tag only after the wire ID
  matches an outstanding request. A response with an unknown or
  stale wire ID is dropped. A spoofable correlation (delivering by
  tag without checking the wire ID) would let a malicious renderer
  drive the wrong handler.
- **No host-side eval surface.** The runtime never `eval`s, never
  uses `new Function(...)` on data sourced from the renderer, and
  does not call dynamic methods looked up by string from incoming
  messages. Strict event guards (`isClick`, `isTimer`, etc.) parse
  through closed enumerations. Discriminated unions on the
  TypeScript side are how unknown variants get rejected at compile
  time and at runtime.
- **App-level hygiene is the app's choice.** An app that wires
  user-provided event content into shell-out commands or
  filesystem paths is making its own choice. The protocol cannot
  enforce app-side hygiene.

## Browser via WASM

When the renderer is a WebAssembly module loaded into a browser
through `WasmTransport`, the trust posture inverts in one direction.
Now the host (the browser tab running the user's TypeScript app)
sits inside an untrusted environment that the user's browser
already isolates against the page. The host SDK's code is loaded
and runs there; a compromised page can drive the host SDK however
it wants. That is not a concern the SDK is positioned to defend
against. The `WasmTransport` boundary is intra-page; the trust
boundary is the browser process, not anything inside it.

The other direction (WASM renderer to host SDK in the same page)
is structurally the same as the native case: the WASM module
emits the same closed event surface the native renderer does.

For the SDK as deployed today, browser-via-WASM is supported as a
deployment shape; it is not the canonical trust scenario. The
asymmetric host/renderer model assumes both sides are processes,
typically with the host in a more privileged context than the
renderer.

## What is not protected today

- **DoS and resource exhaustion.** A malicious renderer can flood
  typed events at the protocol rate. The runtime coalesces
  high-frequency event types on the microtask queue and applies
  configurable `defaultEventRate`; a host SDK still has to handle
  the firehose gracefully (see `resilience.md`).
- **Host-to-renderer surface.** Effect dispatch, file path inputs,
  and renderer-owned child process spawn are full-trust today. Bounding them is the
  capability-manifest direction.
- **Same-access channels.** A user with shell access on the
  machine running the host can read its memory and files
  directly. plushie-typescript does not protect against the user
  acting on themselves.

## Channel posture

The wire protocol is byte-stream agnostic. Confidentiality and
integrity are delegated to the outer transport (OS pipe, Unix
socket, TCP, SSH, mTLS). The wire is not its own crypto layer, by
design. Proposals to add per-message MACs or encrypted fields to
the wire format are misframed; that responsibility belongs with the
outer transport.

The session token at the wire boundary binds a host to a particular
renderer instance. Settings carry `token_sha256`, not the plaintext
token. It is not a confidentiality mechanism.

## Implications

- Work that loosens renderer-to-host integrity (an unsafe decoder
  shape, an opaque-blob delivery path, spoofable response
  correlation, a `new Function` path on incoming data) is a
  deliberate decision, not a routine refactor; default to no.
- Memory-corruption or RCE-shaped findings on either side are in
  scope today regardless of the broader capability-manifest
  direction.
- Host-to-renderer concerns (file path inputs, effect dispatch,
  spawn surface) defer to the capability-manifest roadmap in
  plushie-rust.
- Wire-level confidentiality or integrity expectations belong with
  the outer transport.
- DoS and resource-exhaustion concerns are low priority;
  configurable knobs (`defaultEventRate`) are preferred over
  aggressive defaults.
- Browser-via-WASM is supported as a deployment shape but not
  treated as a hardened trust boundary; threat models that frame
  the page itself as the boundary are out of scope.
