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
  CanvasEvent,
  Event,
  ImeEvent,
  KeyEvent,
  Modifiers,
  ModifiersEvent,
  MouseAreaEvent,
  PaneEvent,
  MouseEvent as PlushieMouseEvent,
  TouchEvent as PlushieTouchEvent,
  SensorEvent,
  SystemEvent,
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
  readonly version: string;
  readonly name: string;
  readonly mode: "windowed" | "headless" | "mock";
  readonly backend: string;
  readonly transport: string;
  readonly extensions: readonly string[];
}

/** Query selector for find/interact messages. */
export interface WireSelector {
  readonly by: "id" | "text" | "role" | "label" | "focused";
  readonly value?: string;
}

/** Result of splitting a scoped wire ID. */
export interface ScopedId {
  readonly id: string;
  readonly scope: readonly string[];
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
 * ```
 */
export function splitScopedId(wireId: string): ScopedId {
  const parts = wireId.split("/");
  if (parts.length === 1) {
    return { id: wireId, scope: [] };
  }
  const id = parts[parts.length - 1]!;
  const scope = parts.slice(0, -1).reverse();
  return { id, scope };
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
): WireMessage {
  const msg: WireMessage = { type: "subscribe", session, kind, tag };
  if (maxRate !== undefined) msg["max_rate"] = maxRate;
  return msg;
}

/** Encode an Unsubscribe message. */
export function encodeUnsubscribe(session: string, kind: string): WireMessage {
  return { type: "unsubscribe", session, kind };
}

/** Encode a WidgetOp message. */
export function encodeWidgetOp(
  session: string,
  op: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "widget_op", session, op, payload };
}

/** Encode a WindowOp message. */
export function encodeWindowOp(
  session: string,
  op: string,
  windowId: string,
  settings: Record<string, unknown>,
): WireMessage {
  return { type: "window_op", session, op, window_id: windowId, settings };
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

/** Encode an ImageOp message. Binary fields must already be encoded (base64 for JSON). */
export function encodeImageOp(
  session: string,
  op: string,
  payload: Record<string, unknown>,
): WireMessage {
  return { type: "image_op", session, op, ...payload };
}

/** Encode an ExtensionCommand message. */
export function encodeExtensionCommand(
  session: string,
  nodeId: string,
  op: string,
  payload: Record<string, unknown> = {},
): WireMessage {
  return { type: "extension_command", session, node_id: nodeId, op, payload };
}

/** Encode an ExtensionCommands (batch) message. */
export function encodeExtensionCommands(
  session: string,
  commands: Array<{ nodeId: string; op: string; payload?: Record<string, unknown> }>,
): WireMessage {
  return {
    type: "extension_commands",
    session,
    commands: commands.map((c) => ({
      node_id: c.nodeId,
      op: c.op,
      payload: c.payload ?? {},
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

/** Parsed response types for request/response correlation. */
export type DecodedResponse =
  | { type: "hello"; data: HelloInfo }
  | { type: "event"; data: Event }
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
  | { type: "effect_stub_registered"; kind: string }
  | { type: "effect_stub_unregistered"; kind: string }
  | { type: "session_error"; session: string; error: string }
  | { type: "session_closed"; session: string; reason: string };

/**
 * Decode a raw wire message into a typed response.
 *
 * @param raw - Deserialized wire message (from msgpack or JSON).
 * @returns Typed decoded response, or null if the message type is unrecognized.
 */
export function decodeMessage(raw: WireMessage): DecodedResponse | null {
  const type = str(raw, "type");

  switch (type) {
    case "hello":
      return { type: "hello", data: decodeHello(raw) };

    case "event":
      return { type: "event", data: decodeEvent(raw) };

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
        rgba: raw["rgba"] ?? null,
      };

    case "reset_response":
      return {
        type: "reset_response",
        id: str(raw, "id"),
        status: str(raw, "status"),
      };

    case "effect_stub_registered":
      return { type: "effect_stub_registered", kind: str(raw, "kind") };

    case "effect_stub_unregistered":
      return { type: "effect_stub_unregistered", kind: str(raw, "kind") };

    default:
      return null;
  }
}

// -- Hello ----------------------------------------------------------------

function decodeHello(raw: WireMessage): HelloInfo {
  return {
    protocol: num(raw, "protocol"),
    version: str(raw, "version"),
    name: str(raw, "name"),
    mode: str(raw, "mode", "windowed") as HelloInfo["mode"],
    backend: str(raw, "backend", "unknown"),
    transport: str(raw, "transport", "stdio"),
    extensions: Array.isArray(raw["extensions"]) ? (raw["extensions"] as string[]) : [],
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
  const data = obj(raw, "data");
  const _session = str(raw, "session");

  // Session lifecycle events (not app-level events)
  if (family === "session_error" || family === "session_closed") {
    return {
      kind: "system",
      type: family,
      tag: "",
      data: data ?? null,
    } as SystemEvent;
  }

  // Widget events (scoped ID)
  if (isWidgetFamily(family)) {
    return decodeWidgetEvent(raw, family, data);
  }

  // Mouse area events (scoped ID)
  if (isMouseAreaFamily(family)) {
    return decodeMouseAreaEvent(raw, family, data);
  }

  // Canvas events (scoped ID)
  if (isCanvasFamily(family)) {
    return decodeCanvasEvent(raw, family, data);
  }

  // Pane events (scoped ID)
  if (isPaneFamily(family)) {
    return decodePaneEvent(raw, family, data);
  }

  // Sensor events (scoped ID)
  if (family === "sensor_resize") {
    return decodeSensorEvent(raw, data);
  }

  // Keyboard events
  if (family === "key_press" || family === "key_release") {
    return decodeKeyEvent(raw, family, data);
  }
  if (family === "modifiers_changed") {
    return decodeModifiersEvent(raw);
  }

  // Mouse events
  if (isMouseFamily(family)) {
    return decodeMouseEvent(raw, family, data);
  }

  // Touch events
  if (isTouchFamily(family)) {
    return decodeTouchEvent(raw, family, data);
  }

  // IME events
  if (isImeFamily(family)) {
    return decodeImeEvent(raw, family, data);
  }

  // Window lifecycle events
  if (isWindowFamily(family)) {
    return decodeWindowEvent(raw, family, data);
  }

  // System events
  if (isSystemFamily(family)) {
    return decodeSystemEvent(raw, family, data);
  }

  // Fallback: treat as a generic widget event for unrecognized families
  return decodeWidgetEvent(raw, family, data);
}

// -- Widget events --------------------------------------------------------

const WIDGET_FAMILIES = new Set([
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
  "sort",
  "scroll",
  "canvas_element_enter",
  "canvas_element_leave",
  "canvas_element_click",
  "canvas_element_drag",
  "canvas_element_drag_end",
  "canvas_element_focused",
  "canvas_element_blurred",
  "canvas_element_key_press",
  "canvas_element_key_release",
  "canvas_focused",
  "canvas_blurred",
  "canvas_group_focused",
  "canvas_group_blurred",
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
  data: WireMessage | null,
): WidgetEvent {
  const wireId = str(raw, "id");
  const { id, scope } = splitScopedId(wireId);
  return {
    kind: "widget",
    type: family as WidgetEvent["type"],
    id,
    scope,
    value: coerceWidgetValue(raw["value"]),
    data: data as WidgetEvent["data"],
  };
}

// -- Mouse area events ----------------------------------------------------

const MOUSE_AREA_FAMILIES = new Set([
  "mouse_right_press",
  "mouse_right_release",
  "mouse_middle_press",
  "mouse_middle_release",
  "mouse_double_click",
  "mouse_enter",
  "mouse_exit",
  "mouse_move",
  "mouse_scroll",
]);

function isMouseAreaFamily(family: string): boolean {
  return MOUSE_AREA_FAMILIES.has(family);
}

function decodeMouseAreaEvent(
  raw: WireMessage,
  family: string,
  data: WireMessage | null,
): MouseAreaEvent {
  const { id, scope } = splitScopedId(str(raw, "id"));
  // Map wire family to MouseAreaEvent type
  const typeMap: Record<string, MouseAreaEvent["type"]> = {
    mouse_right_press: "right_press",
    mouse_right_release: "right_release",
    mouse_middle_press: "middle_press",
    mouse_middle_release: "middle_release",
    mouse_double_click: "double_click",
    mouse_enter: "enter",
    mouse_exit: "exit",
    mouse_move: "move",
    mouse_scroll: "scroll",
  };
  return {
    kind: "mouse_area",
    type: typeMap[family] ?? (family as MouseAreaEvent["type"]),
    id,
    scope,
    data: data as MouseAreaEvent["data"],
  };
}

// -- Canvas events --------------------------------------------------------

const CANVAS_FAMILIES = new Set(["canvas_press", "canvas_release", "canvas_move", "canvas_scroll"]);

function isCanvasFamily(family: string): boolean {
  return CANVAS_FAMILIES.has(family);
}

function decodeCanvasEvent(
  raw: WireMessage,
  family: string,
  data: WireMessage | null,
): CanvasEvent {
  const { id, scope } = splitScopedId(str(raw, "id"));
  const typeMap: Record<string, CanvasEvent["type"]> = {
    canvas_press: "press",
    canvas_release: "release",
    canvas_move: "move",
    canvas_scroll: "scroll",
  };
  return {
    kind: "canvas",
    type: typeMap[family] ?? (family as CanvasEvent["type"]),
    id,
    scope,
    x: data ? num(data, "x") : 0,
    y: data ? num(data, "y") : 0,
    button: data ? (typeof data["button"] === "string" ? data["button"] : "left") : "left",
    data: data as CanvasEvent["data"],
  };
}

// -- Pane events ----------------------------------------------------------

const PANE_FAMILIES = new Set(["pane_resized", "pane_dragged", "pane_clicked", "pane_focus_cycle"]);

function isPaneFamily(family: string): boolean {
  return PANE_FAMILIES.has(family);
}

function decodePaneEvent(raw: WireMessage, family: string, data: WireMessage | null): PaneEvent {
  const { id, scope } = splitScopedId(str(raw, "id"));
  const typeMap: Record<string, PaneEvent["type"]> = {
    pane_resized: "resized",
    pane_dragged: "dragged",
    pane_clicked: "clicked",
    pane_focus_cycle: "focus_cycle",
  };
  return {
    kind: "pane",
    type: typeMap[family] ?? (family as PaneEvent["type"]),
    id,
    scope,
    data: data as PaneEvent["data"],
  };
}

// -- Sensor events --------------------------------------------------------

function decodeSensorEvent(raw: WireMessage, data: WireMessage | null): SensorEvent {
  const { id, scope } = splitScopedId(str(raw, "id"));
  return {
    kind: "sensor",
    type: "resize",
    id,
    scope,
    width: data ? num(data, "width") : 0,
    height: data ? num(data, "height") : 0,
  };
}

// -- Key events -----------------------------------------------------------

function decodeKeyEvent(raw: WireMessage, family: string, data: WireMessage | null): KeyEvent {
  const type = family === "key_press" ? ("press" as const) : ("release" as const);
  return {
    kind: "key",
    type,
    key: data ? str(data, "key") : "",
    modifiedKey: data
      ? typeof data["modified_key"] === "string"
        ? data["modified_key"]
        : null
      : null,
    physicalKey: data
      ? typeof data["physical_key"] === "string"
        ? data["physical_key"]
        : null
      : null,
    modifiers: parseModifiers(raw["modifiers"]),
    location: (data ? str(data, "location", "standard") : "standard") as KeyEvent["location"],
    text: data ? (typeof data["text"] === "string" ? data["text"] : null) : null,
    repeat: data ? data["repeat"] === true : false,
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
  };
}

function decodeModifiersEvent(raw: WireMessage): ModifiersEvent {
  return {
    kind: "modifiers",
    modifiers: parseModifiers(raw["modifiers"]),
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
  };
}

// -- Mouse events ---------------------------------------------------------

const MOUSE_FAMILIES = new Set([
  "cursor_moved",
  "cursor_entered",
  "cursor_left",
  "button_pressed",
  "button_released",
  "wheel_scrolled",
]);

function isMouseFamily(family: string): boolean {
  return MOUSE_FAMILIES.has(family);
}

function decodeMouseEvent(
  raw: WireMessage,
  family: string,
  data: WireMessage | null,
): PlushieMouseEvent {
  const typeMap: Record<string, PlushieMouseEvent["type"]> = {
    cursor_moved: "moved",
    cursor_entered: "entered",
    cursor_left: "left",
    button_pressed: "pressed",
    button_released: "released",
    wheel_scrolled: "scrolled",
  };
  return {
    kind: "mouse",
    type: typeMap[family] ?? "moved",
    x: data ? num(data, "x") : 0,
    y: data ? num(data, "y") : 0,
    button: typeof raw["value"] === "string" ? raw["value"] : null,
    deltaX: data ? num(data, "delta_x") : 0,
    deltaY: data ? num(data, "delta_y") : 0,
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
  };
}

// -- Touch events ---------------------------------------------------------

const TOUCH_FAMILIES = new Set(["finger_pressed", "finger_moved", "finger_lifted", "finger_lost"]);

function isTouchFamily(family: string): boolean {
  return TOUCH_FAMILIES.has(family);
}

function decodeTouchEvent(
  raw: WireMessage,
  family: string,
  data: WireMessage | null,
): PlushieTouchEvent {
  const typeMap: Record<string, PlushieTouchEvent["type"]> = {
    finger_pressed: "pressed",
    finger_moved: "moved",
    finger_lifted: "lifted",
    finger_lost: "lost",
  };
  return {
    kind: "touch",
    type: typeMap[family] ?? "pressed",
    fingerId: data ? num(data, "id") : 0,
    x: data ? num(data, "x") : 0,
    y: data ? num(data, "y") : 0,
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
  };
}

// -- IME events -----------------------------------------------------------

const IME_FAMILIES = new Set(["ime_opened", "ime_preedit", "ime_commit", "ime_closed"]);

function isImeFamily(family: string): boolean {
  return IME_FAMILIES.has(family);
}

function decodeImeEvent(raw: WireMessage, family: string, data: WireMessage | null): ImeEvent {
  const typeMap: Record<string, ImeEvent["type"]> = {
    ime_opened: "opened",
    ime_preedit: "preedit",
    ime_commit: "commit",
    ime_closed: "closed",
  };
  let cursor: readonly [number, number] | null = null;
  if (data && typeof data["cursor"] === "object" && data["cursor"] !== null) {
    const c = data["cursor"] as Record<string, unknown>;
    cursor = [num(c, "start"), num(c, "end")];
  }
  return {
    kind: "ime",
    type: typeMap[family] ?? "opened",
    text: data ? (typeof data["text"] === "string" ? data["text"] : null) : null,
    cursor,
    tag: str(raw, "tag"),
    captured: bool(raw, "captured"),
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

function decodeWindowEvent(
  raw: WireMessage,
  family: string,
  data: WireMessage | null,
): WindowEvent {
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
  return {
    kind: "window",
    type: typeMap[family] ?? (family as WindowEvent["type"]),
    windowId: data ? str(data, "window_id") : "",
    tag: str(raw, "tag"),
    data: data as WindowEvent["data"],
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
  data: WireMessage | null,
): SystemEvent {
  let eventData: unknown = data;

  // Flatten specific system event data
  if (family === "animation_frame" && data) {
    eventData = data["timestamp"] ?? null;
  } else if (family === "theme_changed") {
    eventData = raw["value"] ?? null;
  } else if (family === "announce" && data) {
    eventData = data["text"] ?? null;
  }

  return {
    kind: "system",
    type: family,
    tag: str(raw, "tag"),
    data: eventData,
  };
}
