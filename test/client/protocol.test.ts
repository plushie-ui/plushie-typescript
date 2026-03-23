import { describe, expect, test } from "vitest";
import {
  decodeEvent,
  decodeMessage,
  encodeAdvanceFrame,
  encodeEffect,
  encodeExtensionCommand,
  encodeExtensionCommands,
  encodeImageOp,
  encodeInteract,
  encodePatch,
  encodeQuery,
  encodeReset,
  encodeScreenshot,
  encodeSettings,
  encodeSnapshot,
  encodeSubscribe,
  encodeTreeHash,
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
    const msg = encodeSubscribe("", "on_key_press", "keys");
    expect(msg["kind"]).toBe("on_key_press");
    expect(msg["tag"]).toBe("keys");
    expect(msg["max_rate"]).toBeUndefined();
  });

  test("with max_rate", () => {
    const msg = encodeSubscribe("", "on_mouse_move", "mouse", 30);
    expect(msg["max_rate"]).toBe(30);
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
  test("encodes open with settings", () => {
    const msg = encodeWindowOp("", "open", "win-1", { width: 800, height: 600 });
    expect(msg["type"]).toBe("window_op");
    expect(msg["window_id"]).toBe("win-1");
    const settings = msg["settings"] as Record<string, unknown>;
    expect(settings["width"]).toBe(800);
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
    expect(msg["handle"]).toBe("sprite");
  });

  test("encodeExtensionCommand", () => {
    const msg = encodeExtensionCommand("", "chart-1", "append_data", { values: [1, 2] });
    expect(msg["type"]).toBe("extension_command");
    expect(msg["node_id"]).toBe("chart-1");
  });

  test("encodeExtensionCommands", () => {
    const msg = encodeExtensionCommands("", [
      { nodeId: "chart-1", op: "clear" },
      { nodeId: "chart-2", op: "update", payload: { x: 1 } },
    ]);
    expect(msg["type"]).toBe("extension_commands");
    const cmds = msg["commands"] as Array<Record<string, unknown>>;
    expect(cmds).toHaveLength(2);
    expect(cmds[0]!["node_id"]).toBe("chart-1");
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
      value: 0.75,
    });
    if (event.kind === "widget") {
      expect(event.type).toBe("slide");
      expect(event.value).toBe(0.75);
    }
  });

  test("decodes canvas_shape_click event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "canvas_shape_click",
      id: "canvas_1",
      data: { shape_id: "bar-jan", x: 25, y: 150, button: "left" },
    });
    if (event.kind === "widget") {
      expect(event.type).toBe("canvas_shape_click");
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

  // -- Mouse events --

  test("decodes cursor_moved event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "cursor_moved",
      tag: "mouse",
      data: { x: 100.5, y: 200.3 },
      captured: false,
    });
    expect(event.kind).toBe("mouse");
    if (event.kind === "mouse") {
      expect(event.type).toBe("moved");
      expect(event.x).toBeCloseTo(100.5);
      expect(event.y).toBeCloseTo(200.3);
    }
  });

  test("decodes button_pressed event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "button_pressed",
      tag: "mouse",
      value: "left",
      captured: false,
    });
    if (event.kind === "mouse") {
      expect(event.type).toBe("pressed");
      expect(event.button).toBe("left");
    }
  });

  test("decodes wheel_scrolled event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "wheel_scrolled",
      tag: "mouse",
      data: { delta_x: 0, delta_y: -3, unit: "line" },
      captured: false,
    });
    if (event.kind === "mouse") {
      expect(event.type).toBe("scrolled");
      expect(event.deltaY).toBe(-3);
    }
  });

  // -- Touch events --

  test("decodes finger_pressed event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "finger_pressed",
      tag: "touch",
      data: { id: 1, x: 50, y: 100 },
      captured: false,
    });
    expect(event.kind).toBe("touch");
    if (event.kind === "touch") {
      expect(event.type).toBe("pressed");
      expect(event.fingerId).toBe(1);
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

  // -- Mouse area events --

  test("decodes mouse_right_press event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "mouse_right_press",
      id: "area/context",
    });
    expect(event.kind).toBe("mouse_area");
    if (event.kind === "mouse_area") {
      expect(event.type).toBe("right_press");
      expect(event.id).toBe("context");
      expect(event.scope).toEqual(["area"]);
    }
  });

  // -- Canvas events --

  test("decodes canvas_press event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "canvas_press",
      id: "my_canvas",
      data: { x: 50, y: 100, button: "left" },
    });
    expect(event.kind).toBe("canvas");
    if (event.kind === "canvas") {
      expect(event.type).toBe("press");
      expect(event.x).toBe(50);
      expect(event.button).toBe("left");
    }
  });

  // -- Pane events --

  test("decodes pane_clicked event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "pane_clicked",
      id: "grid",
      data: { pane: "pane_1" },
    });
    expect(event.kind).toBe("pane");
    if (event.kind === "pane") {
      expect(event.type).toBe("clicked");
    }
  });

  // -- Sensor events --

  test("decodes sensor_resize event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "sensor_resize",
      id: "container/sensor_1",
      data: { width: 320, height: 240 },
    });
    expect(event.kind).toBe("sensor");
    if (event.kind === "sensor") {
      expect(event.type).toBe("resize");
      expect(event.id).toBe("sensor_1");
      expect(event.scope).toEqual(["container"]);
      expect(event.width).toBe(320);
      expect(event.height).toBe(240);
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
      expect(event.data).toBe(16000);
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
      expect(event.data).toBe("dark");
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

  // -- Fallback --

  test("unrecognized family falls through to widget event", () => {
    const event = decodeEvent({
      type: "event",
      session: "",
      family: "custom_extension_event",
      id: "widget_1",
      value: "custom_data",
    });
    expect(event.kind).toBe("widget");
    if (event.kind === "widget") {
      expect(event.type).toBe("custom_extension_event");
    }
  });
});
