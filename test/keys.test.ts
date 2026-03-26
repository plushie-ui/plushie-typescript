import { describe, expect, test } from "vitest";
import { resolveKey } from "../src/keys.js";

describe("resolveKey", () => {
  test("resolves exact PascalCase key", () => {
    expect(resolveKey("Escape")).toBe("Escape");
    expect(resolveKey("Enter")).toBe("Enter");
    expect(resolveKey("ArrowUp")).toBe("ArrowUp");
    expect(resolveKey("F1")).toBe("F1");
  });

  test("resolves case-insensitively", () => {
    expect(resolveKey("escape")).toBe("Escape");
    expect(resolveKey("ENTER")).toBe("Enter");
    expect(resolveKey("arrowup")).toBe("ArrowUp");
    expect(resolveKey("backspace")).toBe("Backspace");
    expect(resolveKey("ARROWLEFT")).toBe("ArrowLeft");
  });

  test("single characters are lowercased", () => {
    expect(resolveKey("a")).toBe("a");
    expect(resolveKey("Z")).toBe("z");
    expect(resolveKey("1")).toBe("1");
    expect(resolveKey("/")).toBe("/");
  });

  test("preserves modifier prefixes", () => {
    expect(resolveKey("ctrl+s")).toBe("ctrl+s");
    expect(resolveKey("ctrl+escape")).toBe("ctrl+Escape");
    expect(resolveKey("shift+ENTER")).toBe("shift+Enter");
    expect(resolveKey("alt+arrowdown")).toBe("alt+ArrowDown");
  });

  test("resolves Space by name", () => {
    expect(resolveKey("space")).toBe(" ");
    expect(resolveKey("Space")).toBe(" ");
  });

  test("throws on unknown key", () => {
    expect(() => resolveKey("NotARealKey")).toThrow("Unknown key");
    expect(() => resolveKey("FakeKey")).toThrow("Unknown key");
  });

  test("resolves function keys case-insensitively", () => {
    expect(resolveKey("f12")).toBe("F12");
    expect(resolveKey("f1")).toBe("F1");
    expect(resolveKey("F35")).toBe("F35");
  });

  test("resolves numpad keys case-insensitively", () => {
    expect(resolveKey("numpadenter")).toBe("NumpadEnter");
    expect(resolveKey("NUMPAD0")).toBe("Numpad0");
  });

  test("resolves modifier key names case-insensitively", () => {
    expect(resolveKey("capslock")).toBe("CapsLock");
    expect(resolveKey("numlock")).toBe("NumLock");
    expect(resolveKey("scrolllock")).toBe("ScrollLock");
  });

  test("resolves media keys case-insensitively", () => {
    expect(resolveKey("mediaplaypause")).toBe("MediaPlayPause");
    expect(resolveKey("audiovolumeup")).toBe("AudioVolumeUp");
  });
});
