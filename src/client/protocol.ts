/**
 * Wire protocol message encoding and decoding.
 *
 * Outgoing encoders produce plain JS objects ready for MessagePack or
 * JSON serialization. Incoming decoders convert raw deserialized
 * objects into typed Event/Response structures.
 *
 * All wire messages use string keys. Outgoing messages include a
 * `session` field (defaults to `""` for single-session mode).
 *
 * @module
 */

import type {
  Event,
  ImeEvent,
  KeyEvent,
  Modifiers,
  ModifiersEvent,
  SystemEvent,
  WidgetCommandErrorEvent,
  WidgetEvent,
  WindowEvent,
} from "../types.js";

// =========================================================================
// Wire types
// =========================================================================

/** A wire-format message (plain object with string keys). */
export type WireMessage = Record<string, unknown>;

/** Patch operation as sent on the wire. */
export type WirePatchOp =
  | { op: "replace_node"; path: number[]; node: WireMessage }
  | { op: "update_props"; path: number[]; props: WireMessage }
  | { op: "insert_child"; path: number[]; index: number; node: WireMessage }
  | { op: "remove_child"; path: number[]; index: number };

/** Information from the renderer's hello handshake. */
export interface HelloInfo {
  readonly protocol: number;
  readonly protocol_version: number;
  readonly version: string;
  readonly name: string;
  readonly mode: "windowed" | "headless" | "mock";
  readonly backend: string;
  readonly transport: string;
  readonly extensions: readonly string[];
  readonly native_widgets: readonly string[];
  readonly widgets: readonly string[];
  readonly widget_sets: readonly string[];
}

/** Widget and capability names advertised by the renderer hello message. */
export function helloWidgetCapabilities(
  info: Pick<HelloInfo, "native_widgets" | "widgets" | "extensions">,
): readonly string[] {
  return [...new Set([...info.native_widgets, ...info.widgets, ...info.extensions])];
}

/** Query selector for find/interact messages. */
export interface WireSelector {
  readonly by: "id" | "text" | "role" | "label" | "focused";
  readonly value?: string;
  readonly window_id?: string;
}

/** Result of splitting a scoped wire ID. */
export interface ScopedId {
  readonly id: string;
  readonly scope: readonly string[];
  readonly windowId?: string;
}

// =========================================================================
// Key stringification
// =========================================================================

/**
 * Recursively convert all object keys to strings for wire transport.
 * Atoms (represented as non-string keys) become their string form.
 * Nested objects are stringified recursively. Arrays are mapped.
 * Primitives pass through unchanged.
 */
export function stringifyKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stringifyKeys);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = stringifyKeys(v);
    }
    return result;
  }
  return value;
}

/**
 * Stringify all keys in a tree node recursively (props and children).
 */
function stringifyTree(node: WireMessage): WireMessage {
  return {
    id: node["id"],
    type: node["type"],
    props: stringifyKeys(node["props"]) as WireMessage,
    children: Array.isArray(node["children"])
      ? (node["children"] as WireMessage[]).map(stringifyTree)
      : [],
  };
}

/**
 * Stringify keys in patch operations that carry prop/node data.
 */
function stringifyPatchOps(ops: WirePatchOp[]): WireMessage[] {
  return ops.map((op) => {
    switch (op.op) {
      case "update_props":
        return { ...op, props: stringifyKeys(op.props) as WireMessage };
      case "replace_node":
      case "insert_child":
        return { ...op, node: stringifyTree(op.node) };
      default:
        return op as WireMessage;
    }
  });
}

// =========================================================================
// Scoped ID splitting
// =========================================================================

/**
 * Split a scoped wire ID into local ID and reversed scope chain.
 *
 * @example
 * ```ts
 * splitScopedId("form/email")   // { id: "email", scope: ["form"] }
 * splitScopedId("a/b/c")        // { id: "c", scope: ["b", "a"] }
 * splitScopedId("simple")       // { id: "simple", scope: [] }
 * splitScopedId("main#form/email") // { id: "email", scope: ["form"], windowId: "main" }
 * ```
 */
export function splitScopedId(wireId: string): ScopedId {
  const hashIdx = wireId.indexOf("#");
  const hasWindow = hashIdx > 0;
  const windowId = hasWindow ? wireId.slice(0, hashIdx) : undefined;
  const path = hasWindow ? wireId.slice(hashIdx + 1) : wireId;
  const parts = path.split("/");
  if (parts.length === 1) {
    return windowId ? { id: path, scope: [], windowId } : { id: path, scope: [] };
  }
  const id = parts[parts.length - 1]!;
  const scope = parts.slice(0, -1).reverse();
  return windowId ? { id, scope, windowId } : { id, scope };
}

// =========================================================================
// Outgoing message encoders
// =========================================================================

/** Current protocol version. Must match the renderer's expected version. */
export const PROTOCOL_VERSION = 1;

/**
 * Encode a Settings message.
 * Sent as the first message to configure the renderer.
 */
export function encodeSettings(session: string, settings: Record<string, unknown>): WireMessage {
  return {
    type: "settings",
    session,
    settings: { protocol_version: PROTOCOL_VERSION, ...settings },
  };
}

/** Encode a Snapshot message (full tree replacement). */
export function encodeSnapshot(
  session: string,
  tree: WireMessage | Record<string, unknown>,
): WireMessage {
  return { type: "snapshot", session, tree: stringifyTree(tree as WireMessage) };
}

/** Encode a Patch message (incremental tree update). */
export function encodePatch(session: string, ops: WirePatchOp[]): WireMessage {
  return { type: "patch", session, ops: stringifyPatchOps(ops) };
}

/** Encode a Subscribe message. */
export function encodeSubscribe(
  session: string,
  kind: string,
  tag: string,
  maxRate?: number,
  windowId?: string,
): WireMessage {
  const msg: WireMessage = { type: "subscribe", session, kind, tag };
  if (maxRate !== undefined) msg["max_rate"] = maxRate;
  if (windowId !== undefined) msg["window_id"] = windowId;
  return msg;
}

/** Encode an Unsubscribe message. */
export function encodeUnsubscribe(session: string, kind: string, tag?: string): WireMessage {
  const msg: WireMessage = { type: "unsubscribe", session, kind };
  if (tag !== undefined) msg["tag"] = tag;
  return msg;
}

/** Encode a WidgetOp message. */
export function encodeWidgetOp(
  session: string,
  op: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "widget_op", session, op, payload };
}

/** Encode a WindowOp message.
 *
 * Uses the unified `_op` envelope: op-specific data lives under `payload`;
 * the `window_id` addressing field stays flat beside `op`.
 */
export function encodeWindowOp(
  session: string,
  op: string,
  windowId: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "window_op", session, op, window_id: windowId, payload };
}

/** Encode a SystemOp message.
 *
 * Uses the unified `_op` envelope: op-specific data lives under `payload`.
 */
export function encodeSystemOp(
  session: string,
  op: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "system_op", session, op, payload };
}

/** Encode a SystemQuery message.
 *
 * Uses the unified `_op` envelope: query-specific data lives under `payload`.
 */
export function encodeSystemQuery(
  session: string,
  op: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "system_query", session, op, payload };
}

/** Encode an Effect message. */
export function encodeEffect(
  session: string,
  id: string,
  kind: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "effect", session, id, kind, payload };
}

/** Encode an ImageOp message. Binary fields must already be encoded (base64 for JSON).
 *
 * Uses the unified `_op` envelope: op-specific data lives under `payload`.
 */
export function encodeImageOp(
  session: string,
  op: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "image_op", session, op, payload };
}

/**
 * Encode a LoadFont message.
 *
 * `data` is the raw font bytes. The encoder leaves them as a
 * `Uint8Array` for the MessagePack path (which serializes them as
 * native binary); for the JSON path it base64-encodes them in line
 * with the renderer's incoming-message contract.
 */
export function encodeLoadFont(
  session: string,
  family: string,
  data: Uint8Array,
  format: "msgpack" | "json",
): WireMessage {
  const wireData: unknown = format === "json" ? toBase64(data) : data;
  return { type: "load_font", session, payload: { family, data: wireData } };
}

function toBase64(bytes: Uint8Array): string {
  // Buffer is the cheapest path on Node and is the runtime that all
  // real transports run on. `btoa` is reserved for any future browser
  // path; the WasmTransport is JSON-only and will go through this
  // helper too.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Encode a Command message (unified widget-targeted command). */
export function encodeCommand(
  session: string,
  id: string,
  family: string,
  value: unknown = null,
): WireMessage {
  return { type: "command", session, id, family, value };
}

/** Encode a Commands (batch) message. */
export function encodeCommands(
  session: string,
  commands: Array<{ id: string; family: string; value?: unknown }>,
): WireMessage {
  return {
    type: "commands",
    session,
    commands: commands.map((c) => ({
      id: c.id,
      family: c.family,
      value: c.value ?? null,
    })),
  };
}

/** Encode a Query message. */
export function encodeQuery(
  session: string,
  id: string,
  target: "find" | "tree",
  selector: WireSelector | Record<string, never>,
): WireMessage {
  return { type: "query", session, id, target, selector };
}

/** Encode an Interact message. */
export function encodeInteract(
  session: string,
  id: string,
  action: string,
  selector: WireSelector | Record<string, never>,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "interact", session, id, action, selector, payload };
}

/** Encode a TreeHash message. */
export function encodeTreeHash(session: string, id: string, name: string): WireMessage {
  return { type: "tree_hash", session, id, name };
}

/** Encode a Screenshot message. */
export function encodeScreenshot(
  session: string,
  id: string,
  name: string,
  width?: number,
  height?: number,
): WireMessage {
  const msg: WireMessage = { type: "screenshot", session, id, name };
  if (width !== undefined) msg["width"] = width;
  if (height !== undefined) msg["height"] = height;
  return msg;
}

/** Encode a Reset message. */
export function encodeReset(session: string, id: string): WireMessage {
  return { type: "reset", session, id };
}

/** Encode a RegisterEffectStub message. */
export function encodeRegisterEffectStub(
  session: string,
  kind: string,
  response: unknown,
): WireMessage {
  return { type: "register_effect_stub", session, kind, response };
}

/** Encode an UnregisterEffectStub message. */
export function encodeUnregisterEffectStub(session: string, kind: string): WireMessage {
  return { type: "unregister_effect_stub", session, kind };
}

/** Encode an AdvanceFrame message. */
export function encodeAdvanceFrame(session: string, timestamp: number): WireMessage {
  return { type: "advance_frame", session, timestamp };
}

// =========================================================================
// Incoming message decoders
// =========================================================================

// Helper to safely read a string field.
function str(msg: WireMessage, key: string, fallback = ""): string {
  const v = msg[key];
  return typeof v === "string" ? v : fallback;
}

// Helper to safely read a number field.
function num(msg: WireMessage, key: string, fallback = 0): number {
  const v = msg[key];
  return typeof v === "number" ? v : fallback;
}

// Helper to safely read a boolean field.
function bool(msg: WireMessage, key: string, fallback = false): boolean {
  const v = msg[key];
  return typeof v === "boolean" ? v : fallback;
}

// Helper to read an object field.
function obj(msg: WireMessage, key: string): WireMessage | null {
  const v = msg[key];
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as WireMessage) : null;
}

function normalizeBase64(v: unknown): Uint8Array | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Uint8Array) return v;
  if (typeof v === "string" && v.length > 0) {
    const binary = atob(v);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return null;
}

/** Severity level for a renderer-emitted diagnostic. */
export type DiagnosticLevel = "info" | "warn" | "error";

/**
 * Typed diagnostic payload emitted by the renderer. The shape mirrors
 * the renderer's `Diagnostic` enum: each variant uses a distinct
 * `kind` string and carries the structured fields the emitter knew at
 * the time. Apps narrow on `kind` to access variant-specific fields
 * without manual map lookups.
 */
export type Diagnostic =
  | {
      readonly kind: "duplicate_id";
      readonly id: string;
      readonly window_id: string | null;
    }
  | { readonly kind: "empty_id"; readonly type_name: string }
  | { readonly kind: "multiple_top_level_windows"; readonly window_ids: readonly string[] }
  | {
      readonly kind: "unknown_window";
      readonly window_id: string;
      readonly subscription_tag: string;
    }
  | { readonly kind: "unrecognized_widget_placeholder"; readonly id: string }
  | { readonly kind: "tree_depth_exceeded"; readonly id: string; readonly max_depth: number }
  | { readonly kind: "too_many_duplicates"; readonly limit: number }
  | {
      readonly kind: "widget_id_invalid";
      readonly reason: string;
      readonly type_name: string;
      readonly id: string;
      readonly detail: string;
    }
  | {
      readonly kind: "missing_accessible_name";
      readonly type_name: string;
      readonly id: string;
    }
  | {
      readonly kind: "a11y_ref_unresolved";
      readonly id: string;
      readonly key: string;
      readonly value: string;
      readonly is_member: boolean;
    }
  | {
      readonly kind: "prop_range_exceeded";
      readonly id: string;
      readonly type_name: string;
      readonly prop: string;
      readonly raw: number;
      readonly clamped: number;
      readonly non_finite: boolean;
    }
  | {
      readonly kind: "prop_type_mismatch";
      readonly id: string;
      readonly type_name: string;
      readonly prop: string;
      readonly value_debug: string;
      readonly expected_debug: string;
    }
  | {
      readonly kind: "prop_unknown";
      readonly id: string;
      readonly type_name: string;
      readonly prop: string;
      readonly known_debug: string;
    }
  | {
      readonly kind: "content_length_exceeded";
      readonly id: string;
      readonly field: string;
      readonly actual: number;
      readonly cap: number;
      readonly truncated: number;
    }
  | { readonly kind: "font_cache_cap_exceeded"; readonly max: number }
  | {
      readonly kind: "font_cap_exceeded";
      readonly max: number;
      readonly requested: number;
      readonly granted: number;
      readonly dropped: number;
    }
  | { readonly kind: "font_family_not_found"; readonly family: string }
  | { readonly kind: "invalid_settings"; readonly detail: string }
  | { readonly kind: "required_widgets_missing"; readonly missing: readonly string[] }
  | {
      readonly kind: "widget_panic";
      readonly id: string;
      readonly type_name: string;
      readonly label: string;
    }
  | {
      readonly kind: "svg_parse_error";
      readonly id: string;
      readonly source: string;
      readonly detail: string;
    }
  | {
      readonly kind: "svg_decode_timeout";
      readonly id: string;
      readonly source: string;
      readonly deadline_debug: string;
    }
  | { readonly kind: "dash_cache_cap_exceeded"; readonly max: number }
  | { readonly kind: "emitter_coalesce_cap_exceeded"; readonly cap: number }
  | {
      readonly kind: "widget_id_type_collision";
      readonly id: string;
      readonly existing_type: string;
      readonly incoming_type: string;
    }
  | {
      readonly kind: "view_panicked";
      readonly consecutive: number;
      readonly message: string;
    }
  | {
      readonly kind: "update_panicked";
      readonly consecutive: number;
      readonly message: string;
    }
  | { readonly kind: "unknown_message_type"; readonly msg_type: string }
  | {
      readonly kind: "dispatch_loop_exceeded";
      readonly depth: number;
      readonly limit: number;
    }
  | {
      readonly kind: "buffer_overflow";
      readonly size: number;
      readonly limit: number;
    };

/** Discriminator string for any {@link Diagnostic} variant. */
export type DiagnosticKind = Diagnostic["kind"];

/**
 * Structured diagnostic emitted by the renderer as a top-level
 * `diagnostic` wire message (separate from `event` envelopes).
 *
 * The `diagnostic` field carries the typed payload (`kind` plus
 * variant-specific fields). Diagnostics are also mirrored to the
 * renderer's log channel so existing log consumers keep seeing them.
 */
export interface DiagnosticMessage {
  /**
   * Session the diagnostic is attributable to. An empty string
   * for process-scoped diagnostics (font load failures, renderer
   * startup or panic, writer-dead, anything that affects the
   * whole renderer rather than a single session). Non-empty for
   * session-scoped diagnostics (widget panics, view errors, tree
   * validation warnings, anything produced inside a session's
   * update or apply pipeline).
   */
  readonly session: string;
  readonly level: DiagnosticLevel;
  readonly diagnostic: Diagnostic;
}

/** Parsed response types for request/response correlation. */
export type DecodedResponse =
  | { type: "hello"; data: HelloInfo }
  | { type: "event"; data: Event }
  | { type: "diagnostic"; data: DiagnosticMessage }
  | { type: "effect_response"; id: string; status: string; result: unknown; error: string | null }
  | { type: "query_response"; id: string; target: string; data: unknown }
  | { type: "op_query_response"; kind: string; tag: string; data: unknown }
  | { type: "interact_step"; id: string; events: WireMessage[] }
  | { type: "interact_response"; id: string; events: WireMessage[] }
  | { type: "tree_hash_response"; id: string; name: string; hash: string }
  | {
      type: "screenshot_response";
      id: string;
      name: string;
      hash: string;
      width: number;
      height: number;
      rgba: unknown;
    }
  | { type: "reset_response"; id: string; status: string }
  | { type: "effect_stub_register_ack"; kind: string }
  | { type: "effect_stub_unregister_ack"; kind: string }
  | { type: "session_error"; session: string; code: string; error: string }
  | { type: "session_closed"; session: string; reason: string };

/**
 * Decode a raw wire message into a typed response.
 *
 * @param raw - Deserialized wire message (from msgpack or JSON).
 * @returns Typed decoded response.
 * @throws {Error} If the top-level message type is unrecognized.
 */
export function decodeMessage(raw: WireMessage): DecodedResponse {
  const type = str(raw, "type");

  switch (type) {
    case "hello":
      return { type: "hello", data: decodeHello(raw) };

    case "event":
      return { type: "event", data: decodeEvent(raw) };

    case "diagnostic":
      return { type: "diagnostic", data: decodeDiagnostic(raw) };

    case "effect_response":
      return {
        type: "effect_response",
        id: str(raw, "id"),
        status: str(raw, "status"),
        result: raw["result"] ?? null,
        error: typeof raw["error"] === "string" ? raw["error"] : null,
      };

    case "query_response":
      return {
        type: "query_response",
        id: str(raw, "id"),
        target: str(raw, "target"),
        data: raw["data"] ?? null,
      };

    case "op_query_response":
      return {
        type: "op_query_response",
        kind: str(raw, "kind"),
        tag: str(raw, "tag"),
        data: raw["data"] ?? null,
      };

    case "interact_step":
      return {
        type: "interact_step",
        id: str(raw, "id"),
        events: Array.isArray(raw["events"]) ? (raw["events"] as WireMessage[]) : [],
      };

    case "interact_response":
      return {
        type: "interact_response",
        id: str(raw, "id"),
        events: Array.isArray(raw["events"]) ? (raw["events"] as WireMessage[]) : [],
      };

    case "tree_hash_response":
      return {
        type: "tree_hash_response",
        id: str(raw, "id"),
        name: str(raw, "name"),
        hash: str(raw, "hash"),
      };

    case "screenshot_response":
      return {
        type: "screenshot_response",
        id: str(raw, "id"),
        name: str(raw, "name"),
        hash: str(raw, "hash"),
        width: num(raw, "width"),
        height: num(raw, "height"),
        rgba: normalizeBase64(raw["rgba"]),
      };

    case "reset_response":
      return {
        type: "reset_response",
        id: str(raw, "id"),
        status: str(raw, "status"),
      };

    case "effect_stub_register_ack":
      return { type: "effect_stub_register_ack", kind: str(raw, "kind") };

    case "effect_stub_unregister_ack":
      return { type: "effect_stub_unregister_ack", kind: str(raw, "kind") };

    default:
      throw new Error(
        `Unknown top-level message type "${type}". ` +
          "The renderer sent a wire message this SDK version does not recognize. " +
          "Ensure the SDK and renderer versions are compatible.",
      );
  }
}

// -- Hello ----------------------------------------------------------------

function decodeHello(raw: WireMessage): HelloInfo {
  const protocolVersion = raw["protocol_version"] ?? raw["protocol"];
  const version = raw["version"];
  const name = raw["name"];
  if (typeof protocolVersion !== "number")
    throw new Error("hello message must include numeric 'protocol_version' or 'protocol' field");
  if (typeof version !== "string")
    throw new Error("hello message must include string 'version' field");
  if (typeof name !== "string") throw new Error("hello message must include string 'name' field");
  return {
    protocol: protocolVersion,
    protocol_version: protocolVersion,
    version,
    name,
    mode: str(raw, "mode", "windowed") as HelloInfo["mode"],
    backend: str(raw, "backend", "unknown"),
    transport: str(raw, "transport", "stdio"),
    extensions: Array.isArray(raw["extensions"]) ? (raw["extensions"] as string[]) : [],
    native_widgets: Array.isArray(raw["native_widgets"]) ? (raw["native_widgets"] as string[]) : [],
    widgets: Array.isArray(raw["widgets"]) ? (raw["widgets"] as string[]) : [],
    widget_sets: Array.isArray(raw["widget_sets"]) ? (raw["widget_sets"] as string[]) : [],
  };
}

// -- Diagnostic -----------------------------------------------------------

const DIAGNOSTIC_KINDS: ReadonlySet<DiagnosticKind> = new Set<DiagnosticKind>([
  "duplicate_id",
  "empty_id",
  "multiple_top_level_windows",
  "unknown_window",
  "unrecognized_widget_placeholder",
  "tree_depth_exceeded",
  "too_many_duplicates",
  "widget_id_invalid",
  "missing_accessible_name",
  "a11y_ref_unresolved",
  "prop_range_exceeded",
  "prop_type_mismatch",
  "prop_unknown",
  "content_length_exceeded",
  "font_cache_cap_exceeded",
  "font_cap_exceeded",
  "font_family_not_found",
  "invalid_settings",
  "required_widgets_missing",
  "widget_panic",
  "svg_parse_error",
  "svg_decode_timeout",
  "dash_cache_cap_exceeded",
  "emitter_coalesce_cap_exceeded",
  "widget_id_type_collision",
  "view_panicked",
  "update_panicked",
  "unknown_message_type",
  "dispatch_loop_exceeded",
  "buffer_overflow",
]);

function decodeDiagnostic(raw: WireMessage): DiagnosticMessage {
  const levelRaw = str(raw, "level", "info");
  const level: DiagnosticLevel =
    levelRaw === "warn" || levelRaw === "error" || levelRaw === "info" ? levelRaw : "info";
  const payload = obj(raw, "diagnostic") ?? {};
  const kind = typeof payload["kind"] === "string" ? (payload["kind"] as string) : "";
  if (!DIAGNOSTIC_KINDS.has(kind as DiagnosticKind)) {
    throw new Error(
      `Unknown diagnostic kind "${kind}". ` +
        "The renderer emitted a diagnostic this SDK version does not recognize. " +
        "Ensure the SDK and renderer versions are compatible.",
    );
  }
  // The renderer's Diagnostic enum serializes with `kind` plus
  // variant-specific fields, matching the Diagnostic union shape.
  return {
    session: str(raw, "session"),
    level,
    diagnostic: payload as unknown as Diagnostic,
  };
}

// -- Event decoding -------------------------------------------------------

function parseModifiers(mods: unknown): Modifiers {
  if (typeof mods !== "object" || mods === null) {
    return { ctrl: false, shift: false, alt: false, logo: false, command: false };
  }
  const m = mods as Record<string, unknown>;
  return {
    ctrl: m["ctrl"] === true,
    shift: m["shift"] === true,
    alt: m["alt"] === true,
    logo: m["logo"] === true,
    command: m["command"] === true,
  };
}

/**
 * Decode a wire event message into a typed Event.
 * Dispatches on the `family` field to produce the correct event kind.
 */
export function decodeEvent(raw: WireMessage): Event {
  const family = str(raw, "family");

  // Session lifecycle events (multiplexed mode). The headless session
  // worker emits these as raw envelopes with a `data` payload, so the
  // SDK reads `data` for these two families specifically.
  if (family === "session_error") {
    const session = str(raw, "session");
    const data = obj(raw, "data");
    const code = data && typeof data["code"] === "string" ? (data["code"] as string) : "";
    const errorText = data && typeof data["error"] === "string" ? (data["error"] as string) : "";
    return {
      kind: "session_error",
      session,
      code,
      error: errorText,
    };
  }
  if (family === "session_closed") {
    const session = str(raw, "session");
    const data = obj(raw, "data");
    const reason = data && typeof data["reason"] === "string" ? (data["reason"] as string) : "";
    return {
      kind: "session_closed",
      session,
      reason,
    };
  }

  // Every other event family the renderer emits flows through
  // `OutgoingEvent`, which serializes structured payloads under
  // `value`, never `data`. Each branch below reads `value` (or
  // top-level fields like `modifiers` and `captured`) to match the
  // wire shape.
  const value = obj(raw, "value");

  // Widget events: all widget-scoped events (standard, pointer, pane, etc.)
  // are decoded into WidgetEvent with data maps.
  if (isWidgetFamily(family)) {
    return decodeWidgetEvent(raw, family, value);
  }

  // Key events: dual dispatch. With non-empty id -> WidgetEvent (scoped
  // to a widget, e.g. canvas element). Without id -> global KeyEvent.
  if (family === "key_press" || family === "key_release") {
    const id = str(raw, "id");
    if (id !== "") {
      return decodeWidgetEvent(raw, family, value);
    }
    return decodeKeyEvent(raw, family, value);
  }
  if (family === "modifiers_changed") {
    return decodeModifiersEvent(raw);
  }

  // IME events
  if (isImeFamily(family)) {
    return decodeImeEvent(raw, family, value);
  }

  // Window lifecycle events
  if (isWindowFamily(family)) {
    return decodeWindowEvent(raw, family);
  }

  // System events
  if (isSystemFamily(family)) {
    return decodeSystemEvent(raw, family, value);
  }

  // Subscription pointer events (iced-native families converted to unified WidgetEvents)
  if (isSubscriptionPointerFamily(family)) {
    return decodeSubscriptionPointerEvent(raw, family, value);
  }

  // The renderer and SDK are lock-step; an unrecognized family is a protocol
  // bug. Throwing here surfaces the issue immediately instead of silently
  // producing malformed events that cause confusing failures downstream.
  throw new Error(
    `Unknown event family "${family}". ` +
      "The renderer sent an event type this SDK version does not recognize. " +
      "Ensure the SDK and renderer versions are compatible.",
  );
}

// -- Widget events --------------------------------------------------------

const WIDGET_FAMILIES = new Set([
  // Standard widget events
  "click",
  "input",
  "submit",
  "toggle",
  "select",
  "slide",
  "slide_release",
  "paste",
  "option_hovered",
  "open",
  "close",
  "key_binding",
  "link_click",
  "sort",
  // Unified pointer events
  "press",
  "release",
  "move",
  "scroll",
  "enter",
  "exit",
  "double_click",
  "resize",
  // Scrollable viewport events
  "scrolled",
  // Generic focus/drag events
  "focused",
  "blurred",
  "drag",
  "drag_end",
  // Widget status tracking
  "status",
  // Pane events
  "pane_resized",
  "pane_dragged",
  "pane_clicked",
  "pane_focus_cycle",
  // Animation
  "transition_complete",
  // Diagnostic
  "diagnostic",
]);

function isWidgetFamily(family: string): boolean {
  return WIDGET_FAMILIES.has(family);
}

function coerceWidgetValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return null;
}

function decodeWidgetEvent(
  raw: WireMessage,
  family: string,
  value: WireMessage | null,
): WidgetEvent {
  const wireId = str(raw, "id");
  const { id, scope, windowId } = splitScopedId(wireId);
  // Structured pointer / scroll / resize / key payloads arrive in
  // `value`. Object-shaped values become the event's data map so
  // PointerData / ScrolledData / DragData fields are reachable through
  // `event.data`. The raw `value` is also kept for the scalar `value`
  // slot below (e.g. text input value strings, button strings).
  const rawValue = raw["value"];
  // `captured` lives at the top level on the wire; surface it inside
  // `data` so pointer / scroll / drag events can observe it without a
  // second lookup.
  let mergedData: Record<string, unknown> | null = value ? { ...value } : null;
  if (raw["captured"] === true) {
    mergedData = { ...(mergedData ?? {}), captured: true };
  }
  mergedData = normalizeWidgetPointerData(family, mergedData);
  return {
    kind: "widget",
    type: family as WidgetEvent["type"],
    id,
    windowId: windowId ?? optionalWindowId(raw),
    scope,
    value: coerceWidgetValue(rawValue),
    data: mergedData as WidgetEvent["data"],
  };
}

const POINTER_TYPES = new Set(["mouse", "touch", "pen"]);
const POINTER_BUTTONS = new Set(["left", "right", "middle", "back", "forward"]);

function parsePointerType(raw: unknown): "mouse" | "touch" | "pen" {
  if (raw === undefined || raw === null || raw === "") return "mouse";
  if (typeof raw === "string" && POINTER_TYPES.has(raw)) {
    return raw as "mouse" | "touch" | "pen";
  }
  throw new Error(`Unknown pointer type "${String(raw)}"`);
}

function parsePointerButton(raw: unknown): "left" | "right" | "middle" | "back" | "forward" {
  if (raw === undefined || raw === null || raw === "") return "left";
  if (typeof raw === "string" && POINTER_BUTTONS.has(raw)) {
    return raw as "left" | "right" | "middle" | "back" | "forward";
  }
  throw new Error(`Unknown pointer button "${String(raw)}"`);
}

function normalizeWidgetPointerData(
  family: string,
  data: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (
    family !== "press" &&
    family !== "release" &&
    family !== "move" &&
    family !== "scroll" &&
    family !== "double_click" &&
    family !== "drag" &&
    family !== "drag_end"
  ) {
    return data;
  }

  const normalized = { ...(data ?? {}) };
  if (
    family === "press" ||
    family === "release" ||
    family === "move" ||
    family === "scroll" ||
    family === "double_click"
  ) {
    normalized["pointer"] = parsePointerType(normalized["pointer"]);
  }
  if (family === "press" || family === "release" || family === "drag" || family === "drag_end") {
    normalized["button"] = parsePointerButton(normalized["button"]);
  }
  if (family === "release") {
    normalized["lost"] = normalized["lost"] === true;
  }
  return normalized;
}

// -- Key events -----------------------------------------------------------

/** Extract optional window_id from a wire message. */
function optionalWindowId(msg: WireMessage): string | null {
  return typeof msg["window_id"] === "string" ? msg["window_id"] : null;
}

function decodeKeyEvent(raw: WireMessage, family: string, value: WireMessage | null): KeyEvent {
  const type = family === "key_press" ? ("press" as const) : ("release" as const);
  // The renderer writes the structured key payload (key, modified_key,
  // physical_key, location, text, repeat) under the `value` field of
  // OutgoingEvent. Top-level `modifiers` and `captured` live as
  // siblings on the envelope.
  return {
    kind: "key",
    type,
    key: value ? str(value, "key") : "",
    modifiedKey: value
      ? typeof value["modified_key"] === "string"
        ? value["modified_key"]
        : null
      : null,
    physicalKey: value
      ? typeof value["physical_key"] === "string"
        ? value["physical_key"]
        : null
      : null,
    modifiers: parseModifiers(raw["modifiers"]),
    location: (value ? str(value, "location", "standard") : "standard") as KeyEvent["location"],
    text: value ? (typeof value["text"] === "string" ? value["text"] : null) : null,
    repeat: value ? value["repeat"] === true : false,
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
    windowId: optionalWindowId(raw),
  };
}

function decodeModifiersEvent(raw: WireMessage): ModifiersEvent {
  return {
    kind: "modifiers",
    modifiers: parseModifiers(raw["modifiers"]),
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
    windowId: optionalWindowId(raw),
  };
}

// -- Subscription pointer events -------------------------------------------
//
// Subscription pointer events use iced-native wire families (cursor_moved,
// button_pressed, etc.) distinct from widget pointer events (press, move,
// etc.). Both represent the same physical action at different abstraction
// levels. The SDK converts both to unified WidgetEvent types.

const SUBSCRIPTION_POINTER_FAMILIES = new Set([
  "cursor_moved",
  "cursor_entered",
  "cursor_left",
  "button_pressed",
  "button_released",
  "wheel_scrolled",
  "finger_pressed",
  "finger_moved",
  "finger_lifted",
  "finger_lost",
]);

function isSubscriptionPointerFamily(family: string): boolean {
  return SUBSCRIPTION_POINTER_FAMILIES.has(family);
}

function decodeSubscriptionPointerEvent(
  raw: WireMessage,
  family: string,
  value: WireMessage | null,
): WidgetEvent {
  const windowId = optionalWindowId(raw) ?? "";
  const id = windowId || "__global__";
  // Subscription pointer events carry their structured payload under
  // `value` on the wire (cursor_moved -> {x, y}, wheel_scrolled ->
  // {delta_x, delta_y, unit}, finger_* -> {id, x, y}). button_pressed
  // and button_released use a string `value` (the button name), so
  // `obj(raw, "value")` is null for those branches and they read the
  // top-level `value` directly.

  switch (family) {
    case "cursor_moved":
      return {
        kind: "widget",
        type: "move",
        id,
        windowId,
        scope: [],
        value: null,
        data: {
          x: value ? num(value, "x") : 0,
          y: value ? num(value, "y") : 0,
          pointer: "mouse",
          modifiers: parseModifiers(raw["modifiers"]),
        },
      };

    case "cursor_entered":
      return {
        kind: "widget",
        type: "enter",
        id,
        windowId,
        scope: [],
        value: null,
        data: null,
      };

    case "cursor_left":
      return {
        kind: "widget",
        type: "exit",
        id,
        windowId,
        scope: [],
        value: null,
        data: null,
      };

    case "button_pressed":
    case "button_released":
      return {
        kind: "widget",
        type: family === "button_pressed" ? "press" : "release",
        id,
        windowId,
        scope: [],
        value: null,
        data: {
          button: parsePointerButton(raw["value"]),
          pointer: "mouse",
          ...(family === "button_released" ? { lost: false } : {}),
          modifiers: parseModifiers(raw["modifiers"]),
        },
      };

    case "wheel_scrolled":
      return {
        kind: "widget",
        type: "scroll",
        id,
        windowId,
        scope: [],
        value: null,
        data: {
          delta_x: value ? num(value, "delta_x") : 0,
          delta_y: value ? num(value, "delta_y") : 0,
          unit: value ? str(value, "unit") : "line",
          pointer: "mouse",
          x: 0,
          y: 0,
          modifiers: parseModifiers(raw["modifiers"]),
        },
      };

    case "finger_pressed":
    case "finger_moved":
    case "finger_lifted":
    case "finger_lost": {
      const typeMap: Record<string, string> = {
        finger_pressed: "press",
        finger_moved: "move",
        finger_lifted: "release",
        finger_lost: "release",
      };
      return {
        kind: "widget",
        type: typeMap[family]! as WidgetEvent["type"],
        id,
        windowId,
        scope: [],
        value: null,
        data: {
          pointer: "touch",
          finger: value ? num(value, "id") : 0,
          x: value ? num(value, "x") : 0,
          y: value ? num(value, "y") : 0,
          button: "left",
          ...(family === "finger_lost" ? { lost: true } : {}),
          ...(family === "finger_lifted" ? { lost: false } : {}),
        },
      };
    }

    default:
      // Should not reach here since the set check already matched
      throw new Error(`Unhandled subscription pointer family: ${family}`);
  }
}

// -- IME events -----------------------------------------------------------

const IME_FAMILIES = new Set(["ime_opened", "ime_preedit", "ime_commit", "ime_closed"]);

function isImeFamily(family: string): boolean {
  return IME_FAMILIES.has(family);
}

function decodeImeEvent(raw: WireMessage, family: string, value: WireMessage | null): ImeEvent {
  const typeMap: Record<string, ImeEvent["type"]> = {
    ime_opened: "opened",
    ime_preedit: "preedit",
    ime_commit: "commit",
    ime_closed: "closed",
  };
  // ime_preedit and ime_commit carry their structured payload under
  // `value` on the wire (text, optional cursor span); ime_opened and
  // ime_closed have no payload.
  let cursor: readonly [number, number] | null = null;
  if (value && typeof value["cursor"] === "object" && value["cursor"] !== null) {
    const c = value["cursor"] as Record<string, unknown>;
    cursor = [num(c, "start"), num(c, "end")];
  }
  return {
    kind: "ime",
    type: typeMap[family] ?? "opened",
    text: value ? (typeof value["text"] === "string" ? value["text"] : null) : null,
    cursor,
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
    windowId: optionalWindowId(raw),
  };
}

// -- Window lifecycle events ----------------------------------------------

const WINDOW_FAMILIES = new Set([
  "window_opened",
  "window_closed",
  "window_close_requested",
  "window_moved",
  "window_resized",
  "window_focused",
  "window_unfocused",
  "window_rescaled",
  "file_hovered",
  "file_dropped",
  "files_hovered_left",
]);

function isWindowFamily(family: string): boolean {
  return WINDOW_FAMILIES.has(family);
}

function decodeWindowEvent(raw: WireMessage, family: string): WindowEvent {
  const typeMap: Record<string, WindowEvent["type"]> = {
    window_opened: "opened",
    window_closed: "closed",
    window_close_requested: "close_requested",
    window_moved: "moved",
    window_resized: "resized",
    window_focused: "focused",
    window_unfocused: "unfocused",
    window_rescaled: "rescaled",
    file_hovered: "file_hovered",
    file_dropped: "file_dropped",
    files_hovered_left: "files_hovered_left",
  };
  // Window events from the renderer carry their payload under `value`,
  // matching the OutgoingEvent wire shape. window_opened in particular
  // now puts `x` and `y` at the top of `value` (mirroring window_moved
  // and window_resized) instead of nesting them inside a `position`
  // object, so passing `value` straight through to consumers gives
  // them the new flat shape.
  const payload = obj(raw, "value");
  return {
    kind: "window",
    type: typeMap[family] ?? (family as WindowEvent["type"]),
    windowId: payload ? str(payload, "window_id") : "",
    tag: str(raw, "tag"),
    data: payload as WindowEvent["data"],
  };
}

// -- System events --------------------------------------------------------

const SYSTEM_FAMILIES = new Set([
  "animation_frame",
  "theme_changed",
  "all_windows_closed",
  "announce",
  "error",
]);

function isSystemFamily(family: string): boolean {
  return SYSTEM_FAMILIES.has(family);
}

function decodeSystemEvent(
  raw: WireMessage,
  family: string,
  value: WireMessage | null,
): SystemEvent | WidgetCommandErrorEvent {
  let eventData: unknown = value;

  // Flatten specific system event data. animation_frame and announce
  // wrap their scalar payload in a single-key object on the wire
  // (`{timestamp: ...}`, `{text: ...}`); unwrap so consumers see the
  // scalar directly. theme_changed already carries its mode string as
  // a scalar `value`. The `error` family carries its structured detail
  // as the `value` object, with the source pinned by the top-level id.
  if (family === "animation_frame" && value) {
    eventData = value["timestamp"] ?? null;
  } else if (family === "theme_changed") {
    eventData = raw["value"] ?? null;
  } else if (family === "announce" && value) {
    eventData = value["text"] ?? null;
  } else if (family === "error") {
    if (str(raw, "id") === "widget_command") {
      return {
        kind: "widget_command_error",
        reason: typeof value?.["reason"] === "string" ? (value["reason"] as string) : "",
        nodeId: typeof value?.["node_id"] === "string" ? (value["node_id"] as string) : null,
        family: typeof value?.["family"] === "string" ? (value["family"] as string) : null,
        widgetType:
          typeof value?.["widget_type"] === "string" ? (value["widget_type"] as string) : null,
        message: typeof value?.["message"] === "string" ? (value["message"] as string) : null,
      } as WidgetCommandErrorEvent;
    }
    eventData = value ? { id: str(raw, "id"), ...value } : { id: str(raw, "id") };
  }

  return {
    kind: "system",
    type: family,
    tag: str(raw, "tag"),
    value: eventData,
  };
}
