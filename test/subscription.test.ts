import { describe, expect, test } from "vitest";
import { Subscription } from "../src/index.js";

describe("Subscription", () => {
  test("every() creates a timer subscription", () => {
    const sub = Subscription.every(1000, "tick");
    expect(sub.type).toBe("every");
    expect(sub.tag).toBe("tick");
    expect(sub.interval).toBe(1000);
  });

  test("onKeyPress() creates a key press subscription without tag", () => {
    const sub = Subscription.onKeyPress();
    expect(sub.type).toBe("on_key_press");
    expect(sub.tag).toBeUndefined();
  });

  test("onPointerMove() accepts maxRate", () => {
    const sub = Subscription.onPointerMove({ maxRate: 30 });
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
    const keys = Subscription.onKeyPress();
    expect(Subscription.key(timer)).not.toBe(Subscription.key(keys));
  });

  test("window option scopes subscription to a window", () => {
    const sub = Subscription.onKeyPress({ window: "editor" });
    expect(sub.windowId).toBe("editor");
  });

  test("key() distinguishes window-scoped subscriptions", () => {
    const global = Subscription.onKeyPress();
    const scoped = Subscription.onKeyPress({ window: "editor" });
    expect(Subscription.key(global)).not.toBe(Subscription.key(scoped));
  });

  test("forWindow() scopes a list of subscriptions", () => {
    const subs = Subscription.forWindow("editor", [
      Subscription.onKeyPress(),
      Subscription.onPointerMove({ maxRate: 60 }),
    ]);
    expect(subs).toHaveLength(2);
    expect(subs[0]!.windowId).toBe("editor");
    expect(subs[1]!.windowId).toBe("editor");
    expect(subs[1]!.maxRate).toBe(60);
  });

  test("key() uses type:windowId for renderer subs", () => {
    const sub = Subscription.onPointerMove();
    expect(Subscription.key(sub)).toBe("on_pointer_move:");
  });

  test("key() uses type:windowId for window-scoped renderer subs", () => {
    const sub = Subscription.onPointerMove({ window: "main" });
    expect(Subscription.key(sub)).toBe("on_pointer_move:main");
  });

  test("key() uses type:tag for widget-namespaced subs", () => {
    const sub = { type: "on_key_press", tag: '__cw:{"key":"w","tag":"t"}' } as const;
    expect(Subscription.key(sub)).toBe('on_key_press:__cw:{"key":"w","tag":"t"}');
  });

  test("rendererWireTag() uses kind for global subs", () => {
    const sub = Subscription.onKeyPress();
    expect(Subscription.rendererWireTag(sub)).toBe("on_key_press");
  });

  test("rendererWireTag() includes windowId for scoped subs", () => {
    const sub = Subscription.onKeyPress({ window: "editor" });
    expect(Subscription.rendererWireTag(sub)).toBe("on_key_press:editor");
  });
});
