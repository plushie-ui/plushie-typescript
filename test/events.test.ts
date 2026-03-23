import { describe, expect, test } from "vitest";
import type { AsyncEvent, TimerEvent, WidgetEvent } from "../src/index.js";
import { isAsync, isClick, isTimer, isToggle, target } from "../src/index.js";

const click: WidgetEvent = {
  kind: "widget",
  type: "click",
  id: "save",
  scope: ["form"],
  value: null,
  data: null,
};

const toggle: WidgetEvent = {
  kind: "widget",
  type: "toggle",
  id: "check",
  scope: ["todo_1", "list"],
  value: true,
  data: null,
};

const timer: TimerEvent = {
  kind: "timer",
  tag: "tick",
  timestamp: 1000,
};

const asyncResult: AsyncEvent = {
  kind: "async",
  tag: "fetch",
  result: { ok: true, value: { name: "Lister" } },
};

describe("event type guards", () => {
  test("isClick matches click events", () => {
    expect(isClick(click)).toBe(true);
    expect(isClick(click, "save")).toBe(true);
    expect(isClick(click, "other")).toBe(false);
    expect(isClick(timer)).toBe(false);
  });

  test("isToggle matches toggle events", () => {
    expect(isToggle(toggle)).toBe(true);
    expect(isToggle(toggle, "check")).toBe(true);
    expect(isToggle(click)).toBe(false);
  });

  test("isTimer matches timer events", () => {
    expect(isTimer(timer)).toBe(true);
    expect(isTimer(timer, "tick")).toBe(true);
    expect(isTimer(timer, "tock")).toBe(false);
    expect(isTimer(click)).toBe(false);
  });

  test("isAsync matches async events", () => {
    expect(isAsync(asyncResult)).toBe(true);
    expect(isAsync(asyncResult, "fetch")).toBe(true);
    expect(isAsync(asyncResult, "other")).toBe(false);
  });
});

describe("target", () => {
  test("reconstructs scoped path", () => {
    expect(target(click)).toBe("form/save");
  });

  test("handles unscoped events", () => {
    const unscoped: WidgetEvent = { ...click, scope: [] };
    expect(target(unscoped)).toBe("save");
  });

  test("handles deeply scoped events", () => {
    expect(target(toggle)).toBe("list/todo_1/check");
  });
});
