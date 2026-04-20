import { describe, expect, test } from "vitest";
import { diff } from "../../src/tree/diff.js";
import type { WireNode } from "../../src/tree/normalize.js";

function w(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: WireNode[] = [],
): WireNode {
  return { id, type, props, children };
}

describe("diff", () => {
  // -- Null old tree (first render) --

  test("null old tree produces replace_node at root", () => {
    const tree = w("root", "column");
    const ops = diff(null, tree);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("replace_node");
    if (ops[0]!.op === "replace_node") {
      expect(ops[0]!.path).toEqual([]);
      expect(ops[0]!.node).toBe(tree);
    }
  });

  // -- Identical trees --

  test("identical trees produce no ops", () => {
    const tree = w("root", "column", { spacing: 8 }, [w("a", "text", { content: "hi" })]);
    expect(diff(tree, tree)).toEqual([]);
  });

  test("structurally equal trees produce no ops", () => {
    const old = w("root", "column", { spacing: 8 });
    const now = w("root", "column", { spacing: 8 });
    expect(diff(old, now)).toEqual([]);
  });

  // -- ID / type mismatch --

  test("ID mismatch replaces entire subtree", () => {
    const old = w("root-a", "column");
    const now = w("root-b", "column");
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("replace_node");
  });

  test("type mismatch replaces entire subtree", () => {
    const old = w("root", "column");
    const now = w("root", "row");
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("replace_node");
  });

  // -- Prop changes --

  test("changed prop produces update_props", () => {
    const old = w("root", "text", { content: "hello" });
    const now = w("root", "text", { content: "world" });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
    if (ops[0]!.op === "update_props") {
      expect(ops[0]!.props).toEqual({ content: "world" });
    }
  });

  test("removed prop produces null in update_props", () => {
    const old = w("root", "text", { content: "hi", color: "#ff0000" });
    const now = w("root", "text", { content: "hi" });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    if (ops[0]!.op === "update_props") {
      expect(ops[0]!.props).toEqual({ color: null });
    }
  });

  test("added prop produces update_props", () => {
    const old = w("root", "text", { content: "hi" });
    const now = w("root", "text", { content: "hi", size: 20 });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    if (ops[0]!.op === "update_props") {
      expect(ops[0]!.props).toEqual({ size: 20 });
    }
  });

  // -- Child insertions --

  test("inserting a child produces insert_child", () => {
    const old = w("root", "column", {}, [w("a", "text")]);
    const now = w("root", "column", {}, [w("a", "text"), w("b", "text")]);
    const ops = diff(old, now);
    expect(ops.some((o) => o.op === "insert_child")).toBe(true);
    const insert = ops.find((o) => o.op === "insert_child")!;
    if (insert.op === "insert_child") {
      expect(insert.index).toBe(1);
      expect(insert.node.id).toBe("b");
    }
  });

  // -- Child removals --

  test("removing a child produces remove_child", () => {
    const old = w("root", "column", {}, [w("a", "text"), w("b", "text")]);
    const now = w("root", "column", {}, [w("a", "text")]);
    const ops = diff(old, now);
    expect(ops.some((o) => o.op === "remove_child")).toBe(true);
    const remove = ops.find((o) => o.op === "remove_child")!;
    if (remove.op === "remove_child") {
      expect(remove.index).toBe(1);
    }
  });

  // -- Child reorder --

  test("reordered children trigger replace_node", () => {
    const old = w("root", "column", {}, [w("a", "text"), w("b", "text")]);
    const now = w("root", "column", {}, [w("b", "text"), w("a", "text")]);
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("replace_node");
  });

  // -- Nested diffs --

  test("nested prop change has correct path", () => {
    const old = w("root", "column", {}, [
      w("row", "row", {}, [w("btn", "button", { label: "old" })]),
    ]);
    const now = w("root", "column", {}, [
      w("row", "row", {}, [w("btn", "button", { label: "new" })]),
    ]);
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    if (ops[0]!.op === "update_props") {
      expect(ops[0]!.path).toEqual([0, 0]);
      expect(ops[0]!.props).toEqual({ label: "new" });
    }
  });

  // -- Multiple simultaneous changes --

  test("multiple children removed (descending order)", () => {
    const old = w("root", "column", {}, [
      w("a", "text"),
      w("b", "text"),
      w("c", "text"),
      w("d", "text"),
    ]);
    const now = w("root", "column", {}, [w("a", "text"), w("d", "text")]);
    const ops = diff(old, now);
    const removes = ops.filter((o) => o.op === "remove_child");
    // Removals should be in descending index order
    expect(removes).toHaveLength(2);
    if (removes[0]!.op === "remove_child" && removes[1]!.op === "remove_child") {
      expect(removes[0]!.index).toBeGreaterThan(removes[1]!.index);
    }
  });

  test("mixed add and remove without reorder", () => {
    const old = w("root", "column", {}, [w("a", "text"), w("b", "text")]);
    const now = w("root", "column", {}, [w("a", "text"), w("c", "text")]);
    const ops = diff(old, now);
    expect(ops.some((o) => o.op === "remove_child")).toBe(true);
    expect(ops.some((o) => o.op === "insert_child")).toBe(true);
  });

  // -- Deep equality for props --

  test("deeply equal nested prop objects produce no ops", () => {
    const old = w("root", "text", { style: { base: "primary", background: "#fff" } });
    const now = w("root", "text", { style: { base: "primary", background: "#fff" } });
    expect(diff(old, now)).toEqual([]);
  });

  test("null prop values compare equal", () => {
    const old = w("root", "text", { optional: null });
    const now = w("root", "text", { optional: null });
    expect(diff(old, now)).toEqual([]);
  });

  test("date prop values compare by timestamp", () => {
    expect(
      diff(
        w("root", "text", { updatedAt: new Date("2026-04-24T00:00:00.000Z") }),
        w("root", "text", { updatedAt: new Date("2026-04-24T00:00:00.000Z") }),
      ),
    ).toEqual([]);

    const ops = diff(
      w("root", "text", { updatedAt: new Date("2026-04-24T00:00:00.000Z") }),
      w("root", "text", { updatedAt: new Date("2026-04-25T00:00:00.000Z") }),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });

  test("map and set prop values compare by contents", () => {
    expect(
      diff(
        w("root", "text", { state: new Map([["open", true]]) }),
        w("root", "text", { state: new Map([["open", true]]) }),
      ),
    ).toEqual([]);

    expect(
      diff(
        w("root", "text", { selected: new Set(["a"]) }),
        w("root", "text", { selected: new Set(["b"]) }),
      ),
    ).toHaveLength(1);
  });

  test("too-deep prop values produce a bounded update", () => {
    let oldValue: unknown = "same";
    let newValue: unknown = "same";
    for (let i = 0; i < 9; i++) {
      oldValue = { value: oldValue };
      newValue = { value: newValue };
    }
    const ops = diff(
      w("root", "text", { value: oldValue }),
      w("root", "text", { value: newValue }),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });

  test("changed nested prop object produces update", () => {
    const old = w("root", "text", { style: { base: "primary" } });
    const now = w("root", "text", { style: { base: "secondary" } });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });

  // -- Empty children --

  test("no children to children (all inserts)", () => {
    const old = w("root", "column");
    const now = w("root", "column", {}, [w("a", "text"), w("b", "text")]);
    const ops = diff(old, now);
    const inserts = ops.filter((o) => o.op === "insert_child");
    expect(inserts).toHaveLength(2);
  });

  test("children to no children (all removes)", () => {
    const old = w("root", "column", {}, [w("a", "text"), w("b", "text")]);
    const now = w("root", "column");
    const ops = diff(old, now);
    const removes = ops.filter((o) => o.op === "remove_child");
    expect(removes).toHaveLength(2);
  });

  // -- ID-keyed list props (canvas shapes etc.) ---------------------------

  test("identical id-keyed list prop produces no diff", () => {
    const shapes = [
      { id: "s1", type: "rect", x: 0 },
      { id: "s2", type: "circle", r: 10 },
    ];
    const old = w("c", "canvas", { shapes: [...shapes] });
    const now = w("c", "canvas", { shapes: [...shapes] });
    expect(diff(old, now)).toEqual([]);
  });

  test("id-keyed list content change produces update_props", () => {
    const old = w("c", "canvas", { shapes: [{ id: "s1", type: "rect", x: 0 }] });
    const now = w("c", "canvas", { shapes: [{ id: "s1", type: "rect", x: 5 }] });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });

  test("added id-keyed element produces update_props", () => {
    const old = w("c", "canvas", { shapes: [{ id: "s1", type: "rect" }] });
    const now = w("c", "canvas", {
      shapes: [
        { id: "s1", type: "rect" },
        { id: "s2", type: "circle" },
      ],
    });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });

  test("non-id-keyed list still uses deep-equality", () => {
    const old = w("c", "canvas", { tags: ["a", "b", "c"] });
    const same = w("c", "canvas", { tags: ["a", "b", "c"] });
    expect(diff(old, same)).toEqual([]);

    const different = w("c", "canvas", { tags: ["a", "b", "d"] });
    const ops = diff(old, different);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });

  test("reordered id-keyed list with same content produces no diff", () => {
    // Same id set, same content, different order. Matches the
    // Elixir / Ruby / Gleam contract: id-keyed comparison is set-
    // based, not positional. Lets hosts resort canvas shape lists
    // without forcing a redundant prop update.
    const old = w("c", "canvas", {
      shapes: [
        { id: "s1", type: "rect", x: 0 },
        { id: "s2", type: "circle", r: 10 },
      ],
    });
    const now = w("c", "canvas", {
      shapes: [
        { id: "s2", type: "circle", r: 10 },
        { id: "s1", type: "rect", x: 0 },
      ],
    });
    expect(diff(old, now)).toEqual([]);
  });

  test("id-keyed list with different id sets produces update_props", () => {
    // Same length, but one list carries an id the other doesn't.
    // The helper must refuse equality so the diff still surfaces a
    // real structural change.
    const old = w("c", "canvas", {
      shapes: [
        { id: "s1", type: "rect" },
        { id: "s2", type: "circle" },
      ],
    });
    const now = w("c", "canvas", {
      shapes: [
        { id: "s1", type: "rect" },
        { id: "s3", type: "circle" },
      ],
    });
    const ops = diff(old, now);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("update_props");
  });
});
