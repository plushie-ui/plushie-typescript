import { describe, expect, test } from "vitest";
import clock from "../../examples/clock.js";
import { findById, normalize } from "../../src/tree/index.js";
import type { TimerEvent, UINode } from "../../src/types.js";

describe("clock example", () => {
  const initModel = clock.config.init as Record<string, unknown>;
  const update = clock.config.update!;

  test("init produces a time string", () => {
    expect(typeof initModel["time"]).toBe("string");
    expect((initModel["time"] as string).length).toBeGreaterThan(0);
  });

  test("timer tick updates the time", () => {
    const event: TimerEvent = { kind: "timer", tag: "tick", timestamp: Date.now() };
    const result = update(initModel as never, event);
    const m = result as Record<string, unknown>;
    expect(typeof m["time"]).toBe("string");
  });

  test("unknown events are ignored", () => {
    const event: TimerEvent = { kind: "timer", tag: "unknown", timestamp: 0 };
    const result = update(initModel as never, event);
    expect(result).toEqual(initModel);
  });

  test("has a tick subscription", () => {
    const subs = clock.config.subscriptions!(initModel as never);
    const active = subs.filter(Boolean);
    expect(active.length).toBeGreaterThan(0);
    expect(active.some((s) => s && s.type === "every")).toBe(true);
  });

  test("view shows the time", () => {
    const tree = normalize(clock.config.view(initModel as never) as UINode);
    const display = findById(tree, "clock_display");
    expect(display).not.toBeNull();
    expect(display!.props["content"]).toBe(initModel["time"]);
  });
});
