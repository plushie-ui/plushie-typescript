import { describe, expect, test, vi } from "vitest";
import { isAutoId, normalize } from "../../src/tree/normalize.js";
import type { UINode } from "../../src/types.js";

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: UINode[] = [],
): UINode {
  return Object.freeze({
    id,
    type,
    props: Object.freeze(props),
    children: Object.freeze(children),
  });
}

describe("isAutoId", () => {
  test("detects auto-generated IDs", () => {
    expect(isAutoId("auto:text:1")).toBe(true);
    expect(isAutoId("auto:")).toBe(true);
  });

  test("rejects user IDs", () => {
    expect(isAutoId("my-button")).toBe(false);
    expect(isAutoId("")).toBe(false);
  });
});

describe("normalize", () => {
  test("null produces empty root container", () => {
    const result = normalize(null);
    expect(result.id).toBe("auto:root");
    expect(result.type).toBe("container");
    expect(result.children).toHaveLength(0);
  });

  test("empty array produces empty root container", () => {
    const result = normalize([]);
    expect(result.id).toBe("auto:root");
    expect(result.children).toHaveLength(0);
  });

  test("single node passes through", () => {
    const n = node("root", "column", { spacing: 8 });
    const result = normalize(n);
    expect(result.id).toBe("root");
    expect(result.type).toBe("column");
    expect(result.props).toEqual({ spacing: 8 });
  });

  test("single-element array unwraps", () => {
    const n = node("root", "column");
    const result = normalize([n]);
    expect(result.id).toBe("root");
  });

  test("multi-element array wraps in synthetic root", () => {
    const n1 = node("win1", "window");
    const n2 = node("win2", "window");
    const result = normalize([n1, n2]);
    expect(result.id).toBe("auto:root");
    expect(result.type).toBe("container");
    expect(result.children).toHaveLength(2);
  });

  // -- Scoped IDs --

  test("named container scopes children", () => {
    const child = node("email", "text_input", { value: "" });
    const parent = node("form", "container", {}, [child]);
    const result = normalize(parent);
    expect(result.id).toBe("form");
    expect(result.children[0]!.id).toBe("form/email");
  });

  test("deep scoping chains correctly", () => {
    const button = node("save", "button", { label: "Save" });
    const form = node("form", "container", {}, [button]);
    const app = node("app", "column", {}, [form]);
    const result = normalize(app);
    expect(result.id).toBe("app");
    expect(result.children[0]!.id).toBe("app/form");
    expect(result.children[0]!.children[0]!.id).toBe("app/form/save");
  });

  test("auto-ID containers do NOT scope children", () => {
    const child = node("email", "text_input", { value: "" });
    const parent = node("auto:container:1", "container", {}, [child]);
    const result = normalize(parent);
    expect(result.children[0]!.id).toBe("email");
  });

  test("window nodes do NOT scope children", () => {
    const child = node("content", "column");
    const win = node("main", "window", { title: "App" }, [child]);
    const result = normalize(win);
    expect(result.children[0]!.id).toBe("content");
  });

  test("auto-ID children are NOT prefixed with scope", () => {
    const autoChild = node("auto:text:1", "text", { content: "Hi" });
    const parent = node("form", "container", {}, [autoChild]);
    const result = normalize(parent);
    // Auto-IDs keep their original form even inside named containers
    expect(result.children[0]!.id).toBe("auto:text:1");
  });

  test("mixed scoping: named and auto children", () => {
    const named = node("submit", "button", { label: "Go" });
    const auto = node("auto:text:5", "text", { content: "Info" });
    const parent = node("form", "container", {}, [named, auto]);
    const result = normalize(parent);
    expect(result.children[0]!.id).toBe("form/submit");
    expect(result.children[1]!.id).toBe("auto:text:5");
  });

  // -- Validation --

  test("throws on user ID containing /", () => {
    const bad = node("my/button", "button");
    expect(() => normalize(bad)).toThrow(/contains "\/"/i);
  });

  test("throws on duplicate sibling IDs", () => {
    const child1 = node("btn", "button");
    const child2 = node("btn", "button");
    const parent = node("auto:root", "container", {}, [child1, child2]);
    expect(() => normalize(parent)).toThrow(/Duplicate sibling ID/);
  });

  test("meta field is excluded from wire node", () => {
    const tree: UINode = {
      id: "root",
      type: "container",
      props: { spacing: 8 },
      children: [],
      meta: { route: "/dashboard", debug: true },
    };
    const wire = normalize(tree);
    // Wire node should have id, type, props, children -- no meta
    expect(wire.id).toBe("root");
    expect(wire.props).toEqual({ spacing: 8 });
    expect("meta" in wire).toBe(false);
  });
});
