import { describe, expect, test } from "vitest";
import type { WireNode } from "../../src/tree/normalize.js";
import { detectWindows, findById, findNode } from "../../src/tree/search.js";

function w(id: string, type: string, children: WireNode[] = []): WireNode {
  return { id, type, props: {}, children };
}

describe("findById", () => {
  test("finds root node", () => {
    const tree = w("root", "column");
    expect(findById(tree, "root")?.id).toBe("root");
  });

  test("finds nested node", () => {
    const tree = w("root", "column", [w("row", "row", [w("btn", "button")])]);
    expect(findById(tree, "btn")?.id).toBe("btn");
  });

  test("returns null when not found", () => {
    const tree = w("root", "column");
    expect(findById(tree, "missing")).toBeNull();
  });
});

describe("findNode", () => {
  test("finds by predicate", () => {
    const tree = w("root", "column", [w("a", "text"), w("b", "button")]);
    const result = findNode(tree, (n) => n.type === "button");
    expect(result?.id).toBe("b");
  });
});

describe("detectWindows", () => {
  test("detects root-level window", () => {
    const tree = w("main", "window");
    expect(detectWindows(tree)).toEqual(new Set(["main"]));
  });

  test("detects direct-child windows", () => {
    const tree = w("auto:root", "container", [w("main", "window"), w("settings", "window")]);
    expect(detectWindows(tree)).toEqual(new Set(["main", "settings"]));
  });

  test("ignores deeply nested windows", () => {
    const tree = w("root", "column", [w("wrapper", "container", [w("nested", "window")])]);
    expect(detectWindows(tree)).toEqual(new Set());
  });

  test("returns empty set when no windows", () => {
    const tree = w("root", "column", [w("a", "text")]);
    expect(detectWindows(tree)).toEqual(new Set());
  });
});
