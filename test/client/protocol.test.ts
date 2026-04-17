import { describe, expect, test } from "vitest";
import {
  decodeEvent,
  decodeMessage,
  encodeAdvanceFrame,
  encodeCommand,
  encodeCommands,
  encodeEffect,
  encodeImageOp,
  encodeInteract,
  encodePatch,
  encodeQuery,
  encodeRegisterEffectStub,
  encodeReset,
  encodeScreenshot,
  encodeSettings,
  encodeSnapshot,
  encodeSubscribe,
  encodeSystemOp,
  encodeSystemQuery,
  encodeTreeHash,
  encodeUnregisterEffectStub,
  encodeUnsubscribe,
  encodeWidgetOp,
  encodeWindowOp,
  PROTOCOL_VERSION,
  splitScopedId,
  stringifyKeys,
} from "../../src/client/protocol.js";

// =========================================================================
// Scoped ID splitting
// =========================================================================

describe("splitScopedId", () => {
  test("unscoped ID", () => {
    expect(splitScopedId("button")).toEqual({ id: "button", scope: [] });
  });

  test("single scope level", () => {
    expect(splitScopedId("form/email")).toEqual({ id: "email", scope: ["form"] });
  });

  test("deep scope (reversed ancestor chain)", () => {
    expect(splitScopedId("app/form/email")).toEqual({
      id: "email",
      scope: ["form", "app"],
    });
  });

  test("three levels deep", () => {
    expect(splitScopedId("root/section/panel/button")).toEqual({
      id: "button",
      scope: ["panel", "section", "root"],
    });
  });
});

// =========================================================================
// Key stringification
// =========================================================================

describe("stringifyKeys", () => {
  test("converts object keys to strings", () => {
    expect(stringifyKeys({ a: 1, b: "hello" })).toEqual({ a: 1, b: "hello" });
  });

  test("recursively stringifies nested objects", () => {
    expect(stringifyKeys({ outer: { inner: 42 } })).toEqual({
      outer: { inner: 42 },
    });
  });

  test("maps arrays", () => {
    expect(stringifyKeys([1, { a: 2 }])).toEqual([1, { a: 2 }]);
  });

  test("passes through primitives", () => {
    expect(stringifyKeys(null)).toBeNull();
    expect(stringifyKeys(42)).toBe(42);
    expect(stringifyKeys("hello")).toBe("hello");
    expect(stringifyKeys(true)).toBe(true);
  });
});

// =========================================================================
// Outgoing message encoders
// =========================================================================

describe("encodeSettings", () => {
  test("includes protocol_version", () => {
    const msg = encodeSettings("", { default_text_size: 14 });
    expect(msg["type"]).toBe("settings");
    expect(msg["session"]).toBe("");
    const settings = msg["settings"] as Record<string, unknown>;
    expect(settings["protocol_version"]).toBe(PROTOCOL_VERSION);
    expect(settings["default_text_size"]).toBe(14);
  });
});

describe("encodeSnapshot", () => {
  test("wraps tree with stringified keys", () => {
    const tree = { id: "root", type: "column", props: { spacing: 8 }, children: [] };
    const msg = encodeSnapshot("s1", tree);
    expect(msg["type"]).toBe("snapshot");
    expect(msg["session"]).toBe("s1");
    const t = msg["tree"] as Record<string, unknown>;
    expect(t["id"]).toBe("root");
    const props = t["props"] as Record<string, unknown>;
    expect(props["spacing"]).toBe(8);
  });
});

describe("encodePatch", () => {
  test("stringifies props in patch ops", () => {
    const msg = encodePatch("", [{ op: "update_props", path: [0], props: { label: "hello" } }]);
    const ops = msg["ops"] as Array<Record<string, unknown>>;
    expect(ops[0]!["op"]).toBe("update_props");
    const props = ops[0]!["props"] as Record<string, unknown>;
    expect(props["label"]).toBe("hello");
  });
});

describe("encodeSubscribe", () => {
  test("without max_rate", () => {
    const msg = encodeSubscribe("", "on_key_press", "on_key_press");
    expect(msg["kind"]).toBe("on_key_press");
    expect(msg["tag"]).toBe("on_key_press");
    expect(msg["max_rate"]).toBeUndefined();
  });

  test("with max_rate", () => {
    const msg = encodeSubscribe("", "on_pointer_move", "on_pointer_move", 30);
    expect(msg["max_rate"]).toBe(30);
  });

  test("with window-scoped wire tag", () => {
    const msg = encodeSubscribe("", "on_key_press", "on_key_press:editor", undefined, "editor");
    expect(msg["tag"]).toBe("on_key_press:editor");
    expect(msg["window_id"]).toBe("editor");
  });
});

describe("encodeWidgetOp", () => {
  test("encodes focus op", () => {
    const msg = encodeWidgetOp("", "focus", { target: "input-1" });
    expect(msg["type"]).toBe("widget_op");
    expect(msg["op"]).toBe("focus");
    expect((msg["payload"] as Record<string, unknown>)["target"]).toBe("input-1");
  });
});

describe("encodeWindowOp", () => {
  test("encodes open with payload", () => {
    const msg = encodeWindowOp("", "open", "win-1", { width: 800, height: 600 });
    expect(msg["type"]).toBe("window_op");
    expect(msg["window_id"]).toBe("win-1");
    const payload = msg["payload"] as Record<string, unknown>;
    expect(payload["width"]).toBe(800);
  });
});

describe("encodeSystemOp", () => {
  test("encodes allow_automatic_tabbing", () => {
    const msg = encodeSystemOp("", "allow_automatic_tabbing", { enabled: true });
    expect(msg["type"]).toBe("system_op");
    expect(msg["op"]).toBe("allow_automatic_tabbing");
    expect((msg["payload"] as Record<string, unknown>)["enabled"]).toBe(true);
  });
});

describe("encodeSystemQuery", () => {
  test("encodes get_system_theme", () => {
    const msg = encodeSystemQuery("", "get_system_theme", { tag: "theme-check" });
    expect(msg["type"]).toBe("system_query");
    expect(msg["op"]).toBe("get_system_theme");
    expect((msg["payload"] as Record<string, unknown>)["tag"]).toBe("theme-check");
  });
});

describe("encodeEffect", () => {
  test("encodes file_open effect", () => {
    const msg = encodeEffect("", "ef_1", "file_open", { title: "Open" });
    expect(msg["type"]).toBe("effect");
    expect(msg["id"]).toBe("ef_1");
    expect(msg["kind"]).toBe("file_open");
  });
});

describe("encodeQuery", () => {
  test("encodes find query", () => {
    const msg = encodeQuery("", "q1", "find", { by: "id", value: "btn1" });
    expect(msg["type"]).toBe("query");
    expect(msg["target"]).toBe("find");
  });
});

describe("encodeInteract", () => {
  test("encodes click interaction", () => {
    const msg = encodeInteract("", "i1", "click", { by: "id", value: "btn1" }, {});
    expect(msg["type"]).toBe("interact");
    expect(msg["action"]).toBe("click");
  });

  test("encodes type_text with payload", () => {
    const msg = encodeInteract(
      "",
      "i2",
      "type_text",
      { by: "id", value: "input" },
      { text: "hello" },
    );
    expect((msg["payload"] as Record<string, unknown>)["text"]).toBe("hello");
  });
});

describe("other encoders", () => {
  test("encodeTreeHash", () => {
    const msg = encodeTreeHash("", "th1", "after_click");
    expect(msg["type"]).toBe("tree_hash");
    expect(msg["name"]).toBe("after_click");
  });

  test("encodeScreenshot", () => {
    const msg = encodeScreenshot("", "sc1", "homepage", 1024, 768);
    expect(msg["type"]).toBe("screenshot");
    expect(msg["width"]).toBe(1024);
  });

  test("encodeScreenshot without dimensions", () => {
    const msg = encodeScreenshot("", "sc1", "test");
    expect(msg["width"]).toBeUndefined();
  });

  test("encodeReset", () => {
    const msg = encodeReset("", "r1");
    expect(msg["type"]).toBe("reset");
  });

  test("encodeAdvanceFrame", () => {
    const msg = encodeAdvanceFrame("", 16000);
    expect(msg["type"]).toBe("advance_frame");
    expect(msg["timestamp"]).toBe(16000);
  });

  test("encodeImageOp", () => {
    const msg = encodeImageOp("", "create_image", { handle: "sprite", data: "base64data" });
    expect(msg["type"]).toBe("image_op");
    expect(msg["op"]).toBe("create_image");
    const payload = msg["payload"] as Record<string, unknown>;
    expect(payload["handle"]).toBe("sprite");
    expect(payload["data"]).toBe("base64data");
  });

  test("encodeCommand", () => {
    const msg = encodeCommand("", "chart-1", "append_data", { values: [1, 2] });
    expect(msg["type"]).toBe("command");
    expect(msg["id"]).toBe("chart-1");
    expect(msg["family"]).toBe("append_data");
  });

  test("encodeCommands", () => {
    const msg = encodeCommands("", [
      { id: "chart-1", family: "clear" },
      { id: "chart-2", family: "update", value: { x: 1 } },
    ]);
    expect(msg["type"]).toBe("commands");
    const cmds = msg["commands"] as Array<Record<string, unknown>>;
    expect(cmds).toHaveLength(2);
    expect(cmds[0]!["id"]).toBe("chart-1");
  });

  test("encodeUnsubscribe", () => {
    const msg = encodeUnsubscribe("", "on_key_press");
    expect(msg["type"]).toBe("unsubscribe");
    expect(msg["kind"]).toBe("on_key_press");
  });
});

// =========================================================================
// Incoming message decoders
// =========================================================================

describe("decodeMessage", () => {
  test("decodes hello", () => {
    const result = decodeMessage({
      type: "hello",
      session: "",
      protocol: 1,
      version: "0.4.0",
      name: "plushie",
      mode: "mock",
      backend: "none",
      transport: "stdio",
      extensions: ["charts"],
    });
    expect(result?.type).toBe("hello");
    if (result?.type === "hello") {
      expect(result.data.protocol).toBe(1);
      expect(result.data.mode).toBe("mock");
      expect(result.data.extensions).toEqual(["charts"]);
    }
  });

  test("decodes effect_response ok", () => {
    const result = decodeMessage({
      type: "effect_response",
      id: "ef_1",
      session: "",
      status: "ok",
      result: { path: "/home/user/file.txt" },
    });
    expect(result?.type).toBe("effect_response");
    if (result?.type === "effect_response") {
      expect(result.status).toBe("ok");
      expect(result.result).toEqual({ path: "/home/user/file.txt" });
    }
  });

  test("decodes effect_response cancelled", () => {
    const result = decodeMessage({
      type: "effect_response",
      id: "ef_1",
      session: "",
      status: "cancelled",
    });
    if (result?.type === "effect_response") {
      expect(result.status).toBe("cancelled");
    }
  });

  test("decodes query_response", () => {
    const result = decodeMessage({
      type: "query_response",
      id: "q1",
      session: "",
      target: "find",
      data: { id: "btn1", type: "button", props: {}, children: [] },
    });
    expect(result?.type).toBe("query_response");
  });

  test("decodes tree_hash_response", () => {
    const result = decodeMessage({
      type: "tree_hash_response",
      id: "th1",
      session: "",
      name: "test",
      hash: "abc123",
    });
    if (result?.type === "tree_hash_response") {
      expect(result.hash).toBe("abc123");
    }
  });

  test("decodes reset_response", () => {
    const result = decodeMessage({
      type: "reset_response",
      id: "r1",
      session: "",
      status: "ok",
    });
    expect(result?.type).toBe("reset_response");
  });

  test("returns null for unknown message type", () => {
    expect(decodeMessage({ type: "unknown_thing" })).toBeNull();
  });
});

// =========================================================================
// Event decoding
// =========================================================================

describe("decodeEvent", () => {
  // -- Widget events --

  test("decodes click event with scoped ID", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "click",
      id: "form/save",
      window_id: "main",
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("click");
      expect(event.id).toBe("save");
      expect(event.scope).toEqual(["form"]);
    }
  });

  test("decodes input event with value", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "input",
      id: "email",
      window_id: "main",
      value: "test@example.com",
    });
    if (event.kind === "widget") {
      expect(event.type).toBe("input");
      expect(event.value).toBe("test@example.com");
    }
  });

  test("decodes toggle event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "toggle",
      id: "list/todo_1/check",
      window_id: "main",
      value: true,
    });
    if (event.kind === "widget") {
      expect(event.id).toBe("check");
      expect(event.scope).toEqual(["todo_1", "list"]);
      expect(event.value).toBe(true);
    }
  });

  test("decodes slide event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "slide",
      id: "volume",
      window_id: "main",
      value: 0.75,
    });
    if (event.kind === "widget") {
      expect(event.type).toBe("slide");
      expect(event.value).toBe(0.75);
    }
  });

  test("decodes focused event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "focused",
      id: "canvas_1/element_1",
      window_id: "main",
    });
    if (event.kind === "widget") {
      expect(event.type).toBe("focused");
      expect(event.id).toBe("element_1");
      expect(event.scope).toEqual(["canvas_1"]);
    }
  });

  // -- Key events --

  test("decodes key_press event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "key_press",
      tag: "keys",
      modifiers: { ctrl: true, shift: false, alt: false, logo: false, command: true },
      data: { key: "s", modified_key: "s", physical_key: "KeyS", location: "standard" },
      captured: false,
    });
    expect(event.kind).toBe("key");
    if (event.kind === "key") {
      expect(event.type).toBe("press");
      expect(event.key).toBe("s");
      expect(event.modifiers.ctrl).toBe(true);
      expect(event.modifiers.command).toBe(true);
      expect(event.tag).toBe("keys");
    }
  });

  test("decodes key_press event with window_id", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "key_press",
      tag: "keys",
      modifiers: { ctrl: false, shift: false, alt: false, logo: false, command: false },
      data: { key: "a" },
      captured: false,
      window_id: "editor",
    });
    if (event.kind === "key") {
      expect(event.windowId).toBe("editor");
    }
  });

  test("decodes key_press event without window_id", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "key_press",
      tag: "keys",
      modifiers: { ctrl: false, shift: false, alt: false, logo: false, command: false },
      data: { key: "a" },
      captured: false,
    });
    if (event.kind === "key") {
      expect(event.windowId).toBeNull();
    }
  });

  // -- Subscription pointer events (iced-native families -> WidgetEvent) --

  test("decodes cursor_moved subscription event as move WidgetEvent", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "cursor_moved",
      tag: "mouse",
      data: { x: 100.5, y: 200.3 },
      captured: false,
      window_id: "main",
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("move");
      expect(event.id).toBe("main");
      expect(event.scope).toEqual([]);
      expect(event.data?.["x"]).toBeCloseTo(100.5);
      expect(event.data?.["pointer"]).toBe("mouse");
    }
  });

  test("decodes button_pressed subscription event as press WidgetEvent", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "button_pressed",
      tag: "mouse",
      value: "left",
      captured: false,
      window_id: "main",
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("press");
      expect(event.data?.["button"]).toBe("left");
      expect(event.data?.["pointer"]).toBe("mouse");
    }
  });

  test("decodes wheel_scrolled subscription event as scroll WidgetEvent", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "wheel_scrolled",
      tag: "mouse",
      data: { delta_x: 0, delta_y: -3, unit: "line" },
      captured: false,
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("scroll");
      expect(event.data?.["delta_y"]).toBe(-3);
      expect(event.data?.["unit"]).toBe("line");
    }
  });

  test("decodes finger_pressed subscription event as touch press WidgetEvent", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "finger_pressed",
      tag: "touch",
      data: { id: 1, x: 50, y: 100 },
      captured: false,
      window_id: "main",
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("press");
      expect(event.data?.["pointer"]).toBe("touch");
      expect(event.data?.["finger"]).toBe(1);
      expect(event.data?.["x"]).toBe(50);
    }
  });

  test("decodes cursor_entered as enter WidgetEvent", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "cursor_entered",
      tag: "mouse",
      captured: false,
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("enter");
    }
  });

  test("decodes finger_lost as release with lost flag", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "finger_lost",
      tag: "touch",
      data: { id: 2, x: 0, y: 0 },
      captured: false,
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("release");
      expect(event.data?.["lost"]).toBe(true);
      expect(event.data?.["pointer"]).toBe("touch");
    }
  });

  // -- IME events --

  test("decodes ime_preedit event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "ime_preedit",
      id: "editor",
      data: { text: "compose", cursor: { start: 0, end: 7 } },
      captured: false,
    });
    expect(event.kind).toBe("ime");
    if (event.kind === "ime") {
      expect(event.type).toBe("preedit");
      expect(event.text).toBe("compose");
      expect(event.cursor).toEqual([0, 7]);
    }
  });

  // -- Window events --

  test("decodes window_opened event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "window_opened",
      tag: "windows",
      data: { window_id: "main", width: 800, height: 600, scale_factor: 2.0 },
    });
    expect(event.kind).toBe("window");
    if (event.kind === "window") {
      expect(event.type).toBe("opened");
      expect(event.windowId).toBe("main");
    }
  });

  test("decodes window_resized event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "window_resized",
      tag: "windows",
      data: { window_id: "main", width: 1024, height: 768 },
    });
    if (event.kind === "window") {
      expect(event.type).toBe("resized");
    }
  });

  // -- Unified pointer events --

  test("decodes press event with pointer data", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "press",
      id: "area/context",
      window_id: "main",
      data: { x: 50, y: 100, button: "right", pointer: "mouse" },
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("press");
      expect(event.id).toBe("context");
      expect(event.scope).toEqual(["area"]);
      expect(event.data?.["x"]).toBe(50);
      expect(event.data?.["button"]).toBe("right");
    }
  });

  test("decodes move event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "move",
      id: "canvas",
      window_id: "main",
      data: { x: 50, y: 100, pointer: "mouse" },
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("move");
      expect(event.data?.["x"]).toBe(50);
    }
  });

  // -- Pane events --

  test("decodes pane_clicked event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "pane_clicked",
      id: "grid",
      window_id: "main",
      data: { pane: "pane_1" },
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("pane_clicked");
    }
  });

  // -- Resize events --

  test("decodes resize event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "resize",
      id: "container/sensor_1",
      window_id: "main",
      data: { width: 320, height: 240 },
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("resize");
      expect(event.id).toBe("sensor_1");
      expect(event.scope).toEqual(["container"]);
      expect(event.data?.["width"]).toBe(320);
      expect(event.data?.["height"]).toBe(240);
    }
  });

  // -- System events --

  test("decodes animation_frame event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "animation_frame",
      tag: "frame",
      data: { timestamp: 16000 },
    });
    expect(event.kind).toBe("system");
    if (event.kind === "system") {
      expect(event.type).toBe("animation_frame");
      expect(event.value).toBe(16000);
    }
  });

  test("decodes theme_changed event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "theme_changed",
      tag: "theme",
      value: "dark",
    });
    if (event.kind === "system") {
      expect(event.type).toBe("theme_changed");
      expect(event.value).toBe("dark");
    }
  });

  test("decodes all_windows_closed event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "all_windows_closed",
    });
    if (event.kind === "system") {
      expect(event.type).toBe("all_windows_closed");
    }
  });

  // -- Widget-scoped key events (dual dispatch) --

  test("decodes key_press with id as widget event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "key_press",
      id: "canvas_1/element_1",
      window_id: "main",
      data: { key: "ArrowRight", modifiers: { ctrl: false, shift: false, alt: false } },
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("key_press");
      expect(event.id).toBe("element_1");
      expect(event.scope).toEqual(["canvas_1"]);
    }
  });

  test("decodes key_release with id as widget event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "key_release",
      id: "canvas_1",
      window_id: "main",
      data: { key: "Escape" },
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("key_release");
    }
  });

  test("decodes key_press without id as global key event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "key_press",
      tag: "keys",
      modifiers: { ctrl: false, shift: false, alt: false, logo: false, command: false },
      data: { key: "a" },
      captured: false,
    });
    expect(event.kind).toBe("key");
  });

  // -- Strict decode --

  test("unrecognized family throws", () => {
    expect(() =>
      decodeEvent({
        type: "event",
        session: "",
        family: "completely_unknown_event",
        id: "widget_1",
        window_id: "main",
      }),
    ).toThrow(/Unknown event family "completely_unknown_event"/);
  });
});

// =========================================================================
// Effect stub encoders
// =========================================================================

describe("encodeRegisterEffectStub", () => {
  test("encodes registration with kind and response", () => {
    const msg = encodeRegisterEffectStub("s1", "clipboard_read", "test data");
    expect(msg["type"]).toBe("register_effect_stub");
    expect(msg["session"]).toBe("s1");
    expect(msg["kind"]).toBe("clipboard_read");
    expect(msg["response"]).toBe("test data");
  });

  test("supports object response", () => {
    const msg = encodeRegisterEffectStub("", "save_file", { path: "/tmp/out.txt" });
    expect(msg["response"]).toEqual({ path: "/tmp/out.txt" });
  });
});

describe("encodeUnregisterEffectStub", () => {
  test("encodes unregistration with kind", () => {
    const msg = encodeUnregisterEffectStub("s1", "clipboard_read");
    expect(msg["type"]).toBe("unregister_effect_stub");
    expect(msg["session"]).toBe("s1");
    expect(msg["kind"]).toBe("clipboard_read");
  });
});

// =========================================================================
// Effect stub ack decoding
// =========================================================================

describe("decodeMessage effect stub acks", () => {
  test("decodes effect_stub_registered", () => {
    const result = decodeMessage({
      type: "effect_stub_registered",
      session: "",
      kind: "clipboard_read",
    });
    expect(result?.type).toBe("effect_stub_registered");
    if (result?.type === "effect_stub_registered") {
      expect(result.kind).toBe("clipboard_read");
    }
  });

  test("decodes effect_stub_unregistered", () => {
    const result = decodeMessage({
      type: "effect_stub_unregistered",
      session: "",
      kind: "save_file",
    });
    expect(result?.type).toBe("effect_stub_unregistered");
    if (result?.type === "effect_stub_unregistered") {
      expect(result.kind).toBe("save_file");
    }
  });
});
