import { expect, test } from "vitest";
import {
  isAsync,
  isCanvas,
  isClick,
  isEffect,
  isInput,
  isKey,
  isModifiers,
  isMouse,
  isSelect,
  isSensor,
  isSlide,
  isStream,
  isSubmit,
  isTimer,
  isToggle,
  isTouch,
  isWindow,
  target,
} from "../../src/index.js";
import type {
  AsyncEvent,
  CanvasEvent,
  EffectEvent,
  KeyEvent,
  ModifiersEvent,
  MouseEvent,
  SensorEvent,
  StreamEvent,
  TimerEvent,
  TouchEvent,
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
  };
  expect(isKey(event, "press")).toBe(true);
  expect(event.key).toBe("Escape");
});

// -- Mouse events --

test("events_mouse_moved_guard", () => {
  const event: MouseEvent = {
    kind: "mouse",
    type: "moved",
    x: 100,
    y: 200,
    button: null,
    deltaX: 0,
    deltaY: 0,
    tag: "mouse",
    captured: false,
  };
  expect(isMouse(event)).toBe(true);
  expect(event.x).toBe(100);
  expect(event.y).toBe(200);
});

// -- Touch events --

test("events_touch_pressed_guard", () => {
  const event: TouchEvent = {
    kind: "touch",
    type: "pressed",
    fingerId: 0,
    x: 50,
    y: 75,
    tag: "touch",
    captured: false,
  };
  expect(isTouch(event)).toBe(true);
  expect(event.x).toBe(50);
  expect(event.y).toBe(75);
});

// -- Modifiers events --

test("events_modifiers_changed_guard", () => {
  const event: ModifiersEvent = {
    kind: "modifiers",
    modifiers: { shift: true, ctrl: false, alt: false, logo: false, command: false },
    tag: "mods",
    captured: false,
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

test("events_canvas_press_guard", () => {
  const event: CanvasEvent = {
    kind: "canvas",
    type: "press",
    id: "drawArea",
    scope: [],
    x: 42,
    y: 100,
    button: "left",
    data: null,
  };
  expect(isCanvas(event)).toBe(true);
  expect(event.x).toBe(42);
  expect(event.y).toBe(100);
  expect(event.button).toBe("left");
});

// -- Sensor events --

test("events_sensor_resize_guard", () => {
  const event: SensorEvent = {
    kind: "sensor",
    type: "resize",
    id: "contentArea",
    scope: [],
    width: 800,
    height: 600,
  };
  expect(isSensor(event)).toBe(true);
  expect(event.width).toBe(800);
  expect(event.height).toBe(600);
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
    requestId: "ef_1234",
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
    requestId: "ef_1234",
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
  };

  let result = "fallback";
  if (isClick(event, "save")) result = "save";
  expect(result).toBe("fallback");
});
