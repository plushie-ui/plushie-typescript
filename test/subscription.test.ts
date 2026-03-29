import { describe, expect, test } from "vitest";
import { Subscription } from "../src/index.js";

describe("Subscription", () => {
  test("every() creates a timer subscription", () => {
    const sub = Subscription.every(1000, "tick");
    expect(sub.type).toBe("every");
    expect(sub.tag).toBe("tick");
    expect(sub.interval).toBe(1000);
  });

  test("onKeyPress() creates a key press subscription", () => {
    const sub = Subscription.onKeyPress("keys");
    expect(sub.type).toBe("on_key_press");
    expect(sub.tag).toBe("keys");
  });

  test("onMouseMove() accepts maxRate", () => {
    const sub = Subscription.onMouseMove("mouse", { maxRate: 30 });
    expect(sub.maxRate).toBe(30);
  });

  test("key() produces stable keys for diffing", () => {
    const a = Subscription.every(1000, "tick");
    const b = Subscription.every(1000, "tick");
    expect(Subscription.key(a)).toBe(Subscription.key(b));

    const c = Subscription.every(500, "tick");
    expect(Subscription.key(a)).not.toBe(Subscription.key(c));
  });

  test("key() distinguishes subscription types", () => {
    const timer = Subscription.every(1000, "x");
    const keys = Subscription.onKeyPress("x");
    expect(Subscription.key(timer)).not.toBe(Subscription.key(keys));
  });

  test("window option scopes subscription to a window", () => {
    const sub = Subscription.onKeyPress("keys", { window: "editor" });
    expect(sub.windowId).toBe("editor");
  });

  test("key() distinguishes window-scoped subscriptions", () => {
    const global = Subscription.onKeyPress("keys");
    const scoped = Subscription.onKeyPress("keys", { window: "editor" });
    expect(Subscription.key(global)).not.toBe(Subscription.key(scoped));
  });

  test("forWindow() scopes a list of subscriptions", () => {
    const subs = Subscription.forWindow("editor", [
      Subscription.onKeyPress("keys"),
      Subscription.onMouseMove("mouse", { maxRate: 60 }),
    ]);
    expect(subs).toHaveLength(2);
    expect(subs[0]!.windowId).toBe("editor");
    expect(subs[1]!.windowId).toBe("editor");
    expect(subs[1]!.maxRate).toBe(60);
  });
});
