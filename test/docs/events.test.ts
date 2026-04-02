import { expect, test } from "vitest";
import {
  isAsync,
  isClick,
  isEffect,
  isInput,
  isKey,
  isModifiers,
  isPointer,
  isPress,
  isResize,
  isSelect,
  isSlide,
  isStream,
  isSubmit,
  isTimer,
  isToggle,
  isWindow,
  target,
} from "../../src/index.js";
import type {
  AsyncEvent,
  EffectEvent,
  KeyEvent,
  ModifiersEvent,
  StreamEvent,
  TimerEvent,
  WidgetEvent,
  WindowEvent,
} from "../../src/types.js";

// -- Widget event type guards --

test("events_widget_click_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: [],
    value: null,
    data: null,
    windowId: "main",
  };
  expect(isClick(event)).toBe(true);
  expect(isClick(event, "save")).toBe(true);
  expect(isClick(event, "other")).toBe(false);
});

test("events_widget_input_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "input",
    id: "search",
    scope: [],
    value: "hello",
    data: null,
    windowId: "main",
  };
  expect(isInput(event)).toBe(true);
  expect(isInput(event, "search")).toBe(true);
  expect(event.value).toBe("hello");
});

test("events_widget_submit_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "submit",
    id: "search",
    scope: [],
    value: "query",
    data: null,
    windowId: "main",
  };
  expect(isSubmit(event)).toBe(true);
  expect(isSubmit(event, "search")).toBe(true);
  expect(event.value).toBe("query");
});

test("events_widget_toggle_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "toggle",
    id: "darkMode",
    scope: [],
    value: true,
    data: null,
    windowId: "main",
  };
  expect(isToggle(event)).toBe(true);
  expect(isToggle(event, "darkMode")).toBe(true);
  expect(event.value).toBe(true);
});

test("events_widget_select_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "select",
    id: "themePicker",
    scope: [],
    value: "nord",
    data: null,
    windowId: "main",
  };
  expect(isSelect(event)).toBe(true);
  expect(isSelect(event, "themePicker")).toBe(true);
  expect(event.value).toBe("nord");
});

test("events_widget_slide_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "slide",
    id: "volume",
    scope: [],
    value: 75,
    data: null,
    windowId: "main",
  };
  expect(isSlide(event)).toBe(true);
  expect(isSlide(event, "volume")).toBe(true);
  expect(event.value).toBe(75);
});

// -- Scope matching --

test("events_scope_sidebar_match", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["sidebar"],
    value: null,
    data: null,
    windowId: "main",
  };
  expect(isClick(event, "save")).toBe(true);
  expect(event.scope[0]).toBe("sidebar");
});

test("events_scope_main_match", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["main"],
    value: null,
    data: null,
    windowId: "main",
  };
  expect(isClick(event, "save")).toBe(true);
  expect(event.scope[0]).toBe("main");
});

// -- Target reconstruction --

test("events_target_reconstruction", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["form", "app"],
    value: null,
    data: null,
    windowId: "main",
  };
  expect(target(event)).toBe("app/form/save");
});

test("events_target_no_scope", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: [],
    value: null,
    data: null,
    windowId: "main",
  };
  expect(target(event)).toBe("save");
});

// -- Key events --

test("events_key_press_cmd_s_guard", () => {
  const event: KeyEvent = {
    kind: "key",
    type: "press",
    key: "s",
    modifiedKey: "s",
    physicalKey: "KeyS",
    modifiers: { command: true, ctrl: false, shift: false, alt: false, logo: false },
    location: "standard",
    text: "s",
    repeat: false,
    tag: "keys",
    captured: false,
    windowId: null,
  };
  expect(isKey(event, "press")).toBe(true);
  expect(event.key).toBe("s");
  expect(event.modifiers.command).toBe(true);
});

test("events_key_press_escape_guard", () => {
  const event: KeyEvent = {
    kind: "key",
    type: "press",
    key: "Escape",
    modifiedKey: "Escape",
    physicalKey: "Escape",
    modifiers: { command: false, ctrl: false, shift: false, alt: false, logo: false },
    location: "standard",
    text: null,
    repeat: false,
    tag: "keys",
    captured: false,
    windowId: null,
  };
  expect(isKey(event, "press")).toBe(true);
  expect(event.key).toBe("Escape");
});

// -- Modifiers events --

test("events_modifiers_changed_guard", () => {
  const event: ModifiersEvent = {
    kind: "modifiers",
    modifiers: { shift: true, ctrl: false, alt: false, logo: false, command: false },
    tag: "mods",
    captured: false,
    windowId: null,
  };
  expect(isModifiers(event)).toBe(true);
  expect(event.modifiers.shift).toBe(true);
});

// -- Window events --

test("events_window_close_requested_guard", () => {
  const event: WindowEvent = {
    kind: "window",
    type: "close_requested",
    windowId: "main",
    tag: "",
    data: null,
  };
  expect(isWindow(event)).toBe(true);
  expect(event.type).toBe("close_requested");
  expect(event.windowId).toBe("main");
});

test("events_window_resized_guard", () => {
  const event: WindowEvent = {
    kind: "window",
    type: "resized",
    windowId: "main",
    tag: "",
    data: { width: 800, height: 600 },
  };
  expect(isWindow(event)).toBe(true);
  expect(event.type).toBe("resized");
});

// -- Canvas events --

test("events_pointer_press_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "press",
    id: "drawArea",
    windowId: "main",
    scope: [],
    value: null,
    data: { x: 42, y: 100, button: "left", pointer: "mouse" },
  };
  expect(isPointer(event)).toBe(true);
  expect(isPointer(event, "drawArea")).toBe(true);
  expect(isPress(event, "drawArea")).toBe(true);
  if (isPress(event)) {
    expect(event.data.x).toBe(42);
    expect(event.data.y).toBe(100);
  }
});

// -- Resize events --

test("events_resize_guard", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "resize",
    id: "contentArea",
    windowId: "main",
    scope: [],
    value: null,
    data: { width: 800, height: 600 },
  };
  expect(isResize(event)).toBe(true);
  expect(isResize(event, "contentArea")).toBe(true);
  if (isResize(event)) {
    expect(event.data.width).toBe(800);
    expect(event.data.height).toBe(600);
  }
});

// -- Timer events --

test("events_timer_tick_guard", () => {
  const event: TimerEvent = { kind: "timer", tag: "tick", timestamp: 1_000_000 };
  expect(isTimer(event)).toBe(true);
  expect(isTimer(event, "tick")).toBe(true);
  expect(event.timestamp).toBe(1_000_000);
});

// -- Async events --

test("events_async_result_ok_guard", () => {
  const event: AsyncEvent = {
    kind: "async",
    tag: "dataLoaded",
    result: { ok: true, value: "hello" },
  };
  expect(isAsync(event)).toBe(true);
  expect(isAsync(event, "dataLoaded")).toBe(true);
  expect(event.result.ok).toBe(true);
});

test("events_async_result_error_guard", () => {
  const event: AsyncEvent = {
    kind: "async",
    tag: "dataLoaded",
    result: { ok: false, error: "fail" },
  };
  expect(isAsync(event, "dataLoaded")).toBe(true);
  expect(event.result.ok).toBe(false);
});

// -- Stream events --

test("events_stream_value_guard", () => {
  const event: StreamEvent = { kind: "stream", tag: "fileImport", value: 42 };
  expect(isStream(event)).toBe(true);
  expect(isStream(event, "fileImport")).toBe(true);
});

// -- Effect events --

test("events_effect_ok_guard", () => {
  const event: EffectEvent = {
    kind: "effect",
    tag: "import",
    status: "ok",
    result: { path: "/tmp/notes.txt" },
    error: null,
  };
  expect(isEffect(event)).toBe(true);
  expect(event.status).toBe("ok");
});

test("events_effect_cancelled_guard", () => {
  const event: EffectEvent = {
    kind: "effect",
    tag: "import",
    status: "cancelled",
    result: null,
    error: null,
  };
  expect(isEffect(event)).toBe(true);
  expect(event.status).toBe("cancelled");
});

// -- Pattern matching tips: prefix --

test("events_pattern_prefix_match", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "nav:settings",
    scope: [],
    value: null,
    data: null,
    windowId: "main",
  };

  expect(isClick(event)).toBe(true);
  expect(event.id.startsWith("nav:")).toBe(true);
  const section = event.id.slice(4);
  expect(section).toBe("settings");
});

// -- Catch-all --

test("events_catch_all", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "unknown",
    scope: [],
    value: null,
    data: null,
    windowId: "main",
  };

  let result = "fallback";
  if (isClick(event, "save")) result = "save";
  expect(result).toBe("fallback");
});
