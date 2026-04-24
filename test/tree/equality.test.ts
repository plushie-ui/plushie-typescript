import { describe, expect, test } from "vitest";
import { treeValueEqual } from "../../src/tree/equality.js";

function nested(value: unknown, depth: number): unknown {
  let current = value;
  for (let i = 0; i < depth; i++) {
    current = { current };
  }
  return current;
}

describe("treeValueEqual", () => {
  test("handles null and primitive values", () => {
    expect(treeValueEqual(null, null)).toBe(true);
    expect(treeValueEqual(null, {})).toBe(false);
    expect(treeValueEqual(Number.NaN, Number.NaN)).toBe(true);
  });

  test("compares dates by time", () => {
    expect(
      treeValueEqual(new Date("2026-04-24T00:00:00.000Z"), new Date("2026-04-24T00:00:00.000Z")),
    ).toBe(true);
    expect(
      treeValueEqual(new Date("2026-04-24T00:00:00.000Z"), new Date("2026-04-25T00:00:00.000Z")),
    ).toBe(false);
  });

  test("compares maps and sets by contents", () => {
    expect(
      treeValueEqual(
        new Map<string, unknown>([["mode", { value: "edit" }]]),
        new Map<string, unknown>([["mode", { value: "edit" }]]),
      ),
    ).toBe(true);
    expect(
      treeValueEqual(
        new Map<unknown, unknown>([[{ id: "a" }, { value: "edit" }]]),
        new Map<unknown, unknown>([[{ id: "a" }, { value: "edit" }]]),
      ),
    ).toBe(true);
    expect(
      treeValueEqual(
        new Map<unknown, unknown>([[{ id: "a" }, { value: "edit" }]]),
        new Map<unknown, unknown>([[{ id: "b" }, { value: "edit" }]]),
      ),
    ).toBe(false);
    expect(treeValueEqual(new Map([["mode", "edit"]]), new Map([["mode", "view"]]))).toBe(false);
    expect(
      treeValueEqual(new Set([{ id: "a" }, { id: "b" }]), new Set([{ id: "b" }, { id: "a" }])),
    ).toBe(true);
    expect(treeValueEqual(new Set(["a"]), new Set(["b"]))).toBe(false);
  });

  test("compares regexps by source and flags", () => {
    expect(treeValueEqual(/plushie/iu, /plushie/iu)).toBe(true);
    expect(treeValueEqual(/plushie/i, /plushie/u)).toBe(false);
  });

  test("does not compare arbitrary object instances by empty enumerable keys", () => {
    expect(
      treeValueEqual(new URL("https://example.test/a"), new URL("https://example.test/a")),
    ).toBe(false);
  });

  test("returns false past the recursion limit", () => {
    expect(treeValueEqual(nested("same", 9), nested("same", 9))).toBe(false);
  });
});
