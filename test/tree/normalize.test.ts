import { describe, expect, test } from "vitest";
import { memo, resetMemoCounter } from "../../src/memo.js";
import { diff } from "../../src/tree/diff.js";
import type { NormalizeContext } from "../../src/tree/normalize.js";
import { isAutoId, normalize } from "../../src/tree/normalize.js";
import type { UINode } from "../../src/types.js";
import { buildWidget, type RegistryEntry, type WidgetDef } from "../../src/widget-handler.js";

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
    // Post-normalize auto-populates a11y.role from the widget type.
    expect(result.props).toEqual({ spacing: 8, a11y: { role: "generic_container" } });
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
    const parent = node("form", "column", {}, [named, auto]);
    const result = normalize(parent);
    expect(result.children[0]!.id).toBe("form/submit");
    expect(result.children[1]!.id).toBe("auto:text:5");
  });

  // -- Validation --

  test("throws on user ID containing /", () => {
    const bad = node("my/button", "button");
    expect(() => normalize(bad)).toThrow(/contains "\/"/i);
  });

  test("throws on user ID containing #", () => {
    const bad = node("my#button", "button");
    expect(() => normalize(bad)).toThrow(/contains "#"/i);
  });

  test("throws on empty user ID", () => {
    const bad = node("", "button");
    expect(() => normalize(bad)).toThrow(/must not be empty/i);
  });

  test("throws on user ID with non-ASCII characters", () => {
    const bad = node("bütton", "button");
    expect(() => normalize(bad)).toThrow(/invalid characters/i);
  });

  test("throws on duplicate sibling IDs", () => {
    const child1 = node("btn", "button");
    const child2 = node("btn", "button");
    const parent = node("auto:root", "column", {}, [child1, child2]);
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
    // Wire node should have id, type, props, children; no meta
    expect(wire.id).toBe("root");
    // Post-normalize auto-populates a11y.role from the widget type.
    expect(wire.props).toEqual({ spacing: 8, a11y: { role: "generic_container" } });
    expect("meta" in wire).toBe(false);
  });

  // -- Child count validation --

  test("throws when overlay has fewer than 2 children", () => {
    const overlay = node("popup", "overlay", {}, [node("anchor", "button")]);
    expect(() => normalize(overlay)).toThrow(/overlay "popup" requires exactly 2 children, got 1/);
  });

  test("throws when overlay has more than 2 children", () => {
    const overlay = node("popup", "overlay", {}, [
      node("a", "button"),
      node("b", "button"),
      node("c", "button"),
    ]);
    expect(() => normalize(overlay)).toThrow(/overlay "popup" requires exactly 2 children, got 3/);
  });

  test("overlay with exactly 2 children passes validation", () => {
    const overlay = node("popup", "overlay", {}, [
      node("anchor", "button"),
      node("content", "column"),
    ]);
    expect(() => normalize(overlay)).not.toThrow();
  });

  test("throws when single-child wrapper has multiple children", () => {
    for (const type of [
      "container",
      "tooltip",
      "scrollable",
      "themer",
      "floating",
      "responsive",
      "pin",
      "sensor",
      "window",
    ]) {
      const wrapper = node("w", type, {}, [node("a", "button"), node("b", "button")]);
      expect(() => normalize(wrapper)).toThrow(
        new RegExp(`${type} "w" accepts at most 1 child, got 2`),
      );
    }
  });

  test("single-child wrappers accept 0 or 1 children", () => {
    for (const type of ["container", "tooltip", "scrollable", "themer"]) {
      expect(() => normalize(node("w", type, {}, []))).not.toThrow();
      expect(() => normalize(node("w", type, {}, [node("a", "button")]))).not.toThrow();
    }
  });

  // -- Radio a11y inference --

  test("infers position_in_set/size_of_set for radio siblings with same group", () => {
    const parent = node("form", "column", {}, [
      node("r1", "radio", { group: "color", value: "red" }),
      node("r2", "radio", { group: "color", value: "blue" }),
      node("r3", "radio", { group: "color", value: "green" }),
    ]);
    const wire = normalize(parent);
    const radios = wire.children;
    // Post-normalize also adds role and implicit radio_group peers.
    expect(radios[0]!.props["a11y"]).toEqual({
      position_in_set: 1,
      size_of_set: 3,
      role: "radio_button",
      radio_group: ["form/r1", "form/r2", "form/r3"],
    });
    expect(radios[1]!.props["a11y"]).toEqual({
      position_in_set: 2,
      size_of_set: 3,
      role: "radio_button",
      radio_group: ["form/r1", "form/r2", "form/r3"],
    });
    expect(radios[2]!.props["a11y"]).toEqual({
      position_in_set: 3,
      size_of_set: 3,
      role: "radio_button",
      radio_group: ["form/r1", "form/r2", "form/r3"],
    });
  });

  test("preserves manual position_in_set, fills size_of_set", () => {
    const parent = node("form", "column", {}, [
      node("r1", "radio", { group: "size", value: "s", a11y: { position_in_set: 5 } }),
      node("r2", "radio", { group: "size", value: "m" }),
    ]);
    const wire = normalize(parent);
    expect(wire.children[0]!.props["a11y"]).toEqual({
      position_in_set: 5,
      size_of_set: 2,
      role: "radio_button",
      radio_group: ["form/r1", "form/r2"],
    });
    expect(wire.children[1]!.props["a11y"]).toEqual({
      position_in_set: 2,
      size_of_set: 2,
      role: "radio_button",
      radio_group: ["form/r1", "form/r2"],
    });
  });

  test("skips radios without a group", () => {
    const parent = node("form", "column", {}, [
      node("r1", "radio", { value: "a" }),
      node("r2", "radio", { value: "b" }),
    ]);
    const wire = normalize(parent);
    // Post-normalize still adds the default role.
    expect(wire.children[0]!.props["a11y"]).toEqual({ role: "radio_button" });
    expect(wire.children[1]!.props["a11y"]).toEqual({ role: "radio_button" });
  });
});

// -- Builder-default projections into a11y --

describe("normalize builder-default a11y", () => {
  test("text_input placeholder flows into a11y.description", () => {
    const parent = node("form", "container", {}, [
      node("email", "text_input", { placeholder: "Your email" }),
    ]);
    const wire = normalize(parent);
    const a11y = wire.children[0]!.props["a11y"] as Record<string, unknown>;
    expect(a11y["description"]).toBe("Your email");
  });

  test("explicit a11y.description wins over placeholder-derived default", () => {
    const parent = node("form", "container", {}, [
      node("email", "text_input", {
        placeholder: "Ph",
        a11y: { description: "Explicit" },
      }),
    ]);
    const wire = normalize(parent);
    const a11y = wire.children[0]!.props["a11y"] as Record<string, unknown>;
    expect(a11y["description"]).toBe("Explicit");
  });

  test("required prop flows into a11y.required", () => {
    const parent = node("form", "container", {}, [node("email", "text_input", { required: true })]);
    const wire = normalize(parent);
    const a11y = wire.children[0]!.props["a11y"] as Record<string, unknown>;
    expect(a11y["required"]).toBe(true);
  });

  test("validation invalid tuple flows into a11y.invalid + error_message", () => {
    const parent = node("form", "container", {}, [
      node("email", "text_input", { validation: ["invalid", "Not valid"] }),
    ]);
    const wire = normalize(parent);
    const a11y = wire.children[0]!.props["a11y"] as Record<string, unknown>;
    expect(a11y["invalid"]).toBe(true);
    expect(a11y["error_message"]).toBe("Not valid");
  });

  test("validation valid sets a11y.invalid = false", () => {
    const parent = node("form", "container", {}, [
      node("email", "text_input", { validation: "valid" }),
    ]);
    const wire = normalize(parent);
    const a11y = wire.children[0]!.props["a11y"] as Record<string, unknown>;
    expect(a11y["invalid"]).toBe(false);
  });

  test("tooltip scopes described_by onto its trigger child", () => {
    const parent = node("form", "container", {}, [
      node("help", "tooltip", { tip: "Enter your email" }, [node("email", "text_input", {})]),
    ]);
    const wire = normalize(parent);
    const trigger = wire.children[0]!.children[0]!;
    const a11y = trigger.props["a11y"] as Record<string, unknown>;
    expect(a11y["described_by"]).toBe("form/help");
  });
});

// -- Memo cache tests --

describe("memo", () => {
  test("produces a __memo__ node with metadata", () => {
    resetMemoCounter();
    const m = memo(1, () => node("a", "text"));
    expect(m.type).toBe("__memo__");
    expect(m.id).toBe("auto:memo:1");
    expect(m.meta?.["__memo_deps__"]).toBe(1);
    expect(typeof m.meta?.["__memo_fun__"]).toBe("function");
  });

  test("memo body is evaluated on first render", () => {
    resetMemoCounter();
    let callCount = 0;
    const m = memo("v1", () => {
      callCount++;
      return node("a", "text", { content: "hello" });
    });
    const result = normalize(m);
    expect(callCount).toBe(1);
    expect(result.id).toBe("a");
    expect(result.type).toBe("text");
  });

  test("memo body returns same tree reference on cache hit", () => {
    resetMemoCounter();
    let callCount = 0;
    const body = () => {
      callCount++;
      return node("a", "text", { content: "hello" });
    };

    // First render
    const m1 = memo("v1", body);
    const ctx1: NormalizeContext = {
      memo: new Map(),
      memoPrev: new Map(),
    };
    const result1 = normalize(m1, ctx1);
    expect(callCount).toBe(1);

    // Second render: reset counter (runtime does this before each normalize)
    resetMemoCounter();
    const m2 = memo("v1", body);
    const ctx2: NormalizeContext = {
      memo: new Map(),
      memoPrev: ctx1.memo,
    };
    const result2 = normalize(m2, ctx2);

    // Cache hit: body not re-evaluated. The top-level result is
    // rebuilt by the post-normalize pass, so reference equality no
    // longer holds, but structural equality does.
    expect(callCount).toBe(1);
    expect(result2).toEqual(result1);
  });

  test("memo body is re-evaluated when deps change", () => {
    resetMemoCounter();
    let callCount = 0;
    const body = () => {
      callCount++;
      return node("a", "text", { content: `v${callCount}` });
    };

    const m1 = memo("v1", body);
    const ctx1: NormalizeContext = {
      memo: new Map(),
      memoPrev: new Map(),
    };
    normalize(m1, ctx1);
    expect(callCount).toBe(1);

    // Second render with different deps
    const m2 = memo("v2", body);
    const ctx2: NormalizeContext = {
      memo: new Map(),
      memoPrev: ctx1.memo,
    };
    const result2 = normalize(m2, ctx2);
    expect(callCount).toBe(2);
    expect(result2.props["content"]).toBe("v2");
  });

  test("memo cache evicts oldest entries when the cache limit is reached", () => {
    resetMemoCounter();
    let firstCalls = 0;
    let secondCalls = 0;
    let thirdCalls = 0;
    const bodies = [
      () => {
        firstCalls++;
        return node("a", "text", { content: "a" });
      },
      () => {
        secondCalls++;
        return node("b", "text", { content: "b" });
      },
      () => {
        thirdCalls++;
        return node("c", "text", { content: "c" });
      },
    ] as const;
    const render = () =>
      node(
        "root",
        "column",
        {},
        bodies.map((body) => memo("stable", body)),
      );

    const ctx1: NormalizeContext = {
      newEntries: new Map<string, RegistryEntry>(),
      memo: new Map(),
      memoPrev: new Map(),
      memoCacheLimit: 2,
    };
    normalize(render(), ctx1);
    expect(ctx1.memo?.size).toBe(2);

    resetMemoCounter();
    const ctx2: NormalizeContext = {
      newEntries: new Map<string, RegistryEntry>(),
      memo: new Map(),
      memoPrev: ctx1.memo,
      memoCacheLimit: 2,
    };
    normalize(render(), ctx2);

    expect(firstCalls).toBe(2);
    expect(secondCalls).toBe(1);
    expect(thirdCalls).toBe(1);
    expect(ctx2.memo?.size).toBe(2);
  });

  test("memo with null body returns empty container", () => {
    resetMemoCounter();
    const m = memo(null, () => null);
    const result = normalize(m);
    expect(result.type).toBe("container");
    expect(result.children).toHaveLength(0);
  });

  test("memo with array body wraps multiple children", () => {
    resetMemoCounter();
    const m = memo("v1", () => [node("a", "text"), node("b", "text")]);
    const result = normalize(m);
    expect(result.type).toBe("container");
    expect(result.children).toHaveLength(2);
    expect(result.children[0]!.id).toBe("a");
    expect(result.children[1]!.id).toBe("b");
  });

  test("memo with single-child array unwraps", () => {
    resetMemoCounter();
    const m = memo("v1", () => [node("a", "text")]);
    const result = normalize(m);
    expect(result.id).toBe("a");
    expect(result.type).toBe("text");
  });
});

describe("widget view cache", () => {
  test("evicts oldest entries when the cache limit is reached", () => {
    let childViews = 0;
    const childDef: WidgetDef<object, { readonly label: string }> = {
      view: (id, props) => {
        childViews++;
        return node(`${id}-text`, "text", { content: props.label });
      },
    };
    const parentDef: WidgetDef<object, { readonly label: string }> = {
      view: (id, props) =>
        node(`${id}-box`, "container", {}, [
          buildWidget(childDef, `${id}-child`, { label: props.label }),
        ]),
      cacheKey: (props) => props.label,
    };
    const render = () =>
      node("main", "window", {}, [
        node("content", "column", {}, [
          buildWidget(parentDef, "w1", { label: "stable" }),
          buildWidget(parentDef, "w2", { label: "stable" }),
          buildWidget(parentDef, "w3", { label: "stable" }),
        ]),
      ]);

    const newEntries1 = new Map<string, RegistryEntry>();
    const ctx1: NormalizeContext = {
      registry: new Map<string, RegistryEntry>(),
      newEntries: newEntries1,
      widgetViewPrev: new Map(),
      widgetView: new Map(),
      widgetViewCacheLimit: 2,
    };
    normalize(render(), ctx1);

    expect(childViews).toBe(3);
    expect(ctx1.widgetView?.size).toBe(2);

    const ctx2: NormalizeContext = {
      registry: newEntries1,
      newEntries: new Map<string, RegistryEntry>(),
      widgetViewPrev: ctx1.widgetView,
      widgetView: new Map(),
      widgetViewCacheLimit: 2,
    };
    normalize(render(), ctx2);

    expect(childViews).toBe(4);
    expect(ctx2.widgetView?.size).toBe(2);
  });
});

// -- Diff reference equality --

describe("diff reference equality", () => {
  test("reference-equal nodes produce no patches", () => {
    const shared = { id: "a", type: "text", props: { content: "hi" }, children: [] };
    const ops = diff(shared as never, shared as never);
    expect(ops).toEqual([]);
  });
});
