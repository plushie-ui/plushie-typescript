import { describe, expect, test, vi } from "vitest";
import type { Event, UINode, WidgetEvent } from "../src/types.js";
import {
  buildWidget,
  collectSubscriptions,
  deriveRegistry,
  dispatchThroughWidgets,
  handleWidgetTimer,
  isWidgetTag,
  makeEntry,
  parseWidgetTag,
  type RegistryEntry,
  type WidgetDef,
} from "../src/widget-handler.js";

// -- Helpers -----------------------------------------------------------------

interface CounterState {
  count: number;
}

interface CounterProps {
  max: number;
}

function counterDef(): WidgetDef<CounterState, CounterProps> {
  return {
    init: () => ({ count: 0 }),
    view: (id, props, state) =>
      Object.freeze({
        id,
        type: "canvas",
        props: Object.freeze({ max: props.max, count: state.count }),
        children: Object.freeze([]),
      }),
    handleEvent: (event, state) => {
      if (event.kind === "widget" && (event as WidgetEvent).type === "click") {
        if (state.count < 10) {
          return [
            { type: "emit", kind: "select", data: { value: state.count + 1 } },
            {
              count: state.count + 1,
            },
          ];
        }
        return [{ type: "consumed" }, state];
      }
      return [{ type: "ignored" }, state];
    },
  };
}

function consumingDef(): WidgetDef<object, object> {
  return {
    init: () => ({}),
    view: (id) =>
      Object.freeze({
        id,
        type: "canvas",
        props: Object.freeze({}),
        children: Object.freeze([]),
      }),
    handleEvent: () => [{ type: "consumed" }, {}],
  };
}

function ignoringDef(): WidgetDef<object, object> {
  return {
    init: () => ({}),
    view: (id) =>
      Object.freeze({
        id,
        type: "canvas",
        props: Object.freeze({}),
        children: Object.freeze([]),
      }),
    handleEvent: () => [{ type: "ignored" }, {}],
  };
}

function updateStateDef(): WidgetDef<{ hover: boolean }, object> {
  return {
    init: () => ({ hover: false }),
    view: (id) =>
      Object.freeze({
        id,
        type: "canvas",
        props: Object.freeze({}),
        children: Object.freeze([]),
      }),
    handleEvent: (_event, _state) => [{ type: "update_state" }, { hover: true }],
  };
}

function widgetEvent(
  id: string,
  type: string,
  scope: string[] = [],
  windowId = "main",
): WidgetEvent {
  return {
    kind: "widget",
    type,
    id,
    windowId,
    scope,
    value: null,
    data: null,
  };
}

function registryWith(entries: [string, RegistryEntry][]): Map<string, RegistryEntry> {
  return new Map(entries);
}

// -- buildWidget -------------------------------------------------------

describe("buildWidget", () => {
  test("creates a placeholder node with __widget__ type", () => {
    const def = counterDef();
    const node = buildWidget(def, "stars", { max: 5 });
    expect(node.id).toBe("stars");
    expect(node.type).toBe("__widget__");
    expect(node.children).toHaveLength(0);
    expect(Object.keys(node.props)).toHaveLength(0);
  });

  test("stores def and props in meta", () => {
    const def = counterDef();
    const node = buildWidget(def, "stars", { max: 5 });
    expect(node.meta).toBeDefined();
    expect(node.meta!["__widget_handler__"]).toBe(def);
    expect(node.meta!["__widget_handler_props__"]).toEqual({ max: 5 });
  });

  test("stateless widget (no init) gets empty state", () => {
    const statelessDef: WidgetDef<object, { label: string }> = {
      view: (id, props) =>
        Object.freeze({
          id,
          type: "text",
          props: Object.freeze({ content: props.label }),
          children: Object.freeze([]),
        }),
      handleEvent: (_event, state) => [{ type: "emit", kind: "open" }, state],
    };
    const entry = makeEntry(statelessDef, { label: "hi" }, {});
    const rendered = entry.view("card");
    expect(rendered.type).toBe("text");
    expect(entry.state).toEqual({});
  });

  test("placeholder node is frozen", () => {
    const node = buildWidget(counterDef(), "stars", { max: 5 });
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.props)).toBe(true);
    expect(Object.isFrozen(node.children)).toBe(true);
    expect(Object.isFrozen(node.meta)).toBe(true);
  });
});

// -- makeEntry ---------------------------------------------------------------

describe("makeEntry", () => {
  test("creates an entry with initial state", () => {
    const def = counterDef();
    const entry = makeEntry(def, { max: 5 }, { count: 0 });
    expect(entry.state).toEqual({ count: 0 });
    expect(entry.props).toEqual({ max: 5 });
    expect(entry.def).toBe(def);
  });

  test("render delegates to def.render", () => {
    const def = counterDef();
    const entry = makeEntry(def, { max: 5 }, { count: 3 });
    const node = entry.view("my-counter");
    expect(node.id).toBe("my-counter");
    expect(node.props).toEqual({ max: 5, count: 3 });
  });

  test("handleEvent returns updated entry", () => {
    const def = counterDef();
    const entry = makeEntry(def, { max: 5 }, { count: 0 });
    const ev = widgetEvent("btn", "click", ["my-counter"]);
    const [action, newEntry] = entry.handleEvent!(ev);
    expect(action).toEqual({ type: "emit", kind: "select", data: { value: 1 } });
    expect(newEntry.state).toEqual({ count: 1 });
  });
});

// -- dispatchThroughWidgets --------------------------------------------------

describe("dispatchThroughWidgets", () => {
  test("passes through when registry is empty", () => {
    const ev = widgetEvent("btn", "click");
    const registry = new Map<string, RegistryEntry>();
    const result = dispatchThroughWidgets(registry, ev);
    expect(result.event).toBe(ev);
  });

  test("passes through when no widgets match scope", () => {
    const def = counterDef();
    const entry = makeEntry(def, { max: 5 }, { count: 0 });
    const registry = registryWith([["other", entry]]);
    const ev = widgetEvent("btn", "click", ["form"]);
    const result = dispatchThroughWidgets(registry, ev);
    expect(result.event).toEqual(ev);
  });

  test("consumed event returns null", () => {
    const entry = makeEntry(consumingDef(), {}, {});
    const registry = registryWith([["main\u0000form", entry]]);
    const ev = widgetEvent("btn", "click", ["form"]);
    const result = dispatchThroughWidgets(registry, ev);
    expect(result.event).toBeNull();
  });

  test("update_state event returns null", () => {
    const entry = makeEntry(updateStateDef(), {}, { hover: false });
    const registry = registryWith([["main\u0000form", entry]]);
    const ev = widgetEvent("btn", "click", ["form"]);
    const result = dispatchThroughWidgets(registry, ev);
    expect(result.event).toBeNull();
    // State should be updated
    expect(result.registry.get("main\u0000form")!.state).toEqual({ hover: true });
  });

  test("ignored event passes through to app", () => {
    const entry = makeEntry(ignoringDef(), {}, {});
    const registry = registryWith([["main\u0000form", entry]]);
    const ev = widgetEvent("btn", "click", ["form"]);
    const result = dispatchThroughWidgets(registry, ev);
    expect(result.event).toEqual(ev);
  });

  test("emit replaces event with WidgetEvent", () => {
    const entry = makeEntry(counterDef(), { max: 5 }, { count: 0 });
    const registry = registryWith([["main\u0000stars", entry]]);
    const ev = widgetEvent("star-3", "click", ["stars"]);
    const result = dispatchThroughWidgets(registry, ev);

    expect(result.event).not.toBeNull();
    const emitted = result.event as WidgetEvent;
    expect(emitted.kind).toBe("widget");
    expect(emitted.type).toBe("select");
    expect(emitted.id).toBe("stars");
    expect(emitted.windowId).toBe("main");
    expect(emitted.scope).toEqual([]);
    expect(emitted.data).toEqual({ value: 1 });
  });

  test("emit with value routes to WidgetEvent.value", () => {
    const valueDef: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (_event, state) => [{ type: "emit", kind: "select", value: 42 }, state],
    };
    const entry = makeEntry(valueDef, {}, {});
    const registry = registryWith([["main\u0000picker", entry]]);
    const ev = widgetEvent("btn", "click", ["picker"]);
    const result = dispatchThroughWidgets(registry, ev);

    expect(result.event).not.toBeNull();
    const emitted = result.event as WidgetEvent;
    expect(emitted.type).toBe("select");
    expect(emitted.value).toBe(42);
    expect(emitted.data).toBeNull();
  });

  test("emit with data routes to WidgetEvent.data", () => {
    const dataDef: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (_event, state) => [
        { type: "emit", kind: "change", data: { hue: 180, saturation: 0.5 } },
        state,
      ],
    };
    const entry = makeEntry(dataDef, {}, {});
    const registry = registryWith([["main\u0000picker", entry]]);
    const ev = widgetEvent("btn", "click", ["picker"]);
    const result = dispatchThroughWidgets(registry, ev);

    expect(result.event).not.toBeNull();
    const emitted = result.event as WidgetEvent;
    expect(emitted.type).toBe("change");
    expect(emitted.value).toBeNull();
    expect(emitted.data).toEqual({ hue: 180, saturation: 0.5 });
  });

  test("emit resolves id and scope from interception context", () => {
    const entry = makeEntry(counterDef(), { max: 5 }, { count: 0 });
    // Widget at form/stars, event from an inner element
    const registry = registryWith([["main\u0000form/stars", entry]]);
    const ev = widgetEvent("star-3", "click", ["stars", "form"]);
    const result = dispatchThroughWidgets(registry, ev);

    expect(result.event).not.toBeNull();
    const emitted = result.event as WidgetEvent;
    expect(emitted.id).toBe("stars");
    expect(emitted.windowId).toBe("main");
    expect(emitted.scope).toEqual(["form"]);
  });

  test("direct-target fallback for events targeting a widget", () => {
    const entry = makeEntry(counterDef(), { max: 5 }, { count: 0 });
    // Canvas press event where the widget IS the target
    const registry = registryWith([["main\u0000picker", entry]]);
    const ev: Event = {
      kind: "widget",
      type: "press",
      id: "picker",
      windowId: "main",
      scope: [],
      value: null,
      data: { x: 10, y: 20, button: "left" },
    };
    const result = dispatchThroughWidgets(registry, ev);
    // counterDef ignores non-widget events
    expect(result.event).toEqual(ev);
  });

  test("chain walks innermost to outermost", () => {
    const calls: string[] = [];

    const innerDef: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (_event, state) => {
        calls.push("inner");
        return [{ type: "emit", kind: "inner_click", data: null }, state];
      },
    };

    const outerDef: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (_event, state) => {
        calls.push("outer");
        return [{ type: "consumed" }, state];
      },
    };

    const registry = registryWith([
      ["main\u0000outer/inner", makeEntry(innerDef, {}, {})],
      ["main\u0000outer", makeEntry(outerDef, {}, {})],
    ]);

    const ev = widgetEvent("btn", "click", ["inner", "outer"]);
    const result = dispatchThroughWidgets(registry, ev);

    expect(calls).toEqual(["inner", "outer"]);
    expect(result.event).toBeNull();
  });

  test("same widget ids in different windows stay separate", () => {
    const left = makeEntry(counterDef(), { max: 5 }, { count: 0 });
    const right = makeEntry(counterDef(), { max: 5 }, { count: 4 });
    const registry = registryWith([
      ["left\u0000stars", left],
      ["right\u0000stars", right],
    ]);

    const result = dispatchThroughWidgets(
      registry,
      widgetEvent("star-3", "click", ["stars"], "right"),
    );
    const emitted = result.event as WidgetEvent;

    expect(emitted.id).toBe("stars");
    expect(emitted.windowId).toBe("right");
    expect(result.registry.get("left\u0000stars")!.state).toEqual({ count: 0 });
    expect(result.registry.get("right\u0000stars")!.state).toEqual({ count: 5 });
  });

  test("handler error is caught and treated as ignored", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const crashDef: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: () => {
        throw new Error("kaboom");
      },
    };

    const registry = registryWith([["main\u0000widget", makeEntry(crashDef, {}, {})]]);
    const ev = widgetEvent("btn", "click", ["widget"]);
    const result = dispatchThroughWidgets(registry, ev);

    expect(result.event).toEqual(ev);
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});

// -- Widget-scoped subscriptions ---------------------------------------------

describe("widget subscriptions", () => {
  test("collectSubscriptions gathers from all widgets", () => {
    const def: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (_event, state) => [{ type: "ignored" }, state],
      subscriptions: () => [{ type: "every", tag: "tick", interval: 100 }],
    };

    const registry = registryWith([
      ["widget-a", makeEntry(def, {}, {})],
      ["widget-b", makeEntry(def, {}, {})],
    ]);

    const subs = collectSubscriptions(registry);
    expect(subs).toHaveLength(2);
    expect(parseWidgetTag(subs[0]!.tag)).toEqual({ widgetId: "widget-a", innerTag: "tick" });
    expect(parseWidgetTag(subs[1]!.tag)).toEqual({ widgetId: "widget-b", innerTag: "tick" });
  });

  test("isWidgetTag detects namespaced tags", () => {
    expect(isWidgetTag('__cw:{"key":"widget-a","tag":"tick"}')).toBe(true);
    expect(isWidgetTag("my-timer")).toBe(false);
  });

  test("parseWidgetTag extracts widget ID and inner tag", () => {
    const result = parseWidgetTag('__cw:{"key":"form/stars","tag":"tick"}');
    expect(result).toEqual({ widgetId: "form/stars", innerTag: "tick" });
  });

  test("parseWidgetTag returns null for non-widget tags", () => {
    expect(parseWidgetTag("my-timer")).toBeNull();
  });
});

// -- handleWidgetTimer -------------------------------------------------------

describe("handleWidgetTimer", () => {
  test("returns null for non-widget timer tags", () => {
    const registry = new Map<string, RegistryEntry>();
    const result = handleWidgetTimer(registry, "app-tick", 1000);
    expect(result).toBeNull();
  });

  test("routes timer to widget handler", () => {
    const timerDef: WidgetDef<{ ticks: number }, object> = {
      init: () => ({ ticks: 0 }),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (event, state) => {
        if (event.kind === "timer") {
          return [{ type: "update_state" }, { ticks: state.ticks + 1 }];
        }
        return [{ type: "ignored" }, state];
      },
    };

    const registry = registryWith([["main\u0000widget-a", makeEntry(timerDef, {}, { ticks: 0 })]]);
    const result = handleWidgetTimer(
      registry,
      '__cw:{"key":"main\\u0000widget-a","tag":"tick"}',
      1000,
    );

    expect(result).not.toBeNull();
    expect(result!.event).toBeNull();
    expect(result!.registry.get("main\u0000widget-a")!.state).toEqual({ ticks: 1 });
  });

  test("timer emit dispatches through scope chain", () => {
    const emittingDef: WidgetDef<object, object> = {
      init: () => ({}),
      view: (id) =>
        Object.freeze({
          id,
          type: "canvas",
          props: Object.freeze({}),
          children: Object.freeze([]),
        }),
      handleEvent: (event, state) => {
        if (event.kind === "timer") {
          return [{ type: "emit", kind: "tick_event", data: { ts: 42 } }, state];
        }
        return [{ type: "ignored" }, state];
      },
    };

    const registry = registryWith([["main\u0000my-widget", makeEntry(emittingDef, {}, {})]]);
    const result = handleWidgetTimer(
      registry,
      '__cw:{"key":"main\\u0000my-widget","tag":"tick"}',
      1000,
    );

    expect(result).not.toBeNull();
    expect(result!.event).not.toBeNull();
    const ev = result!.event as WidgetEvent;
    expect(ev.type).toBe("tick_event");
    expect(ev.windowId).toBe("main");
    expect(ev.data).toEqual({ ts: 42 });
  });
});

// -- deriveRegistry ----------------------------------------------------------

describe("deriveRegistry", () => {
  test("returns empty map for null tree", () => {
    const registry = deriveRegistry(null);
    expect(registry.size).toBe(0);
  });

  test("extracts entries from nodes with widget meta", () => {
    const def = counterDef();
    const child: UINode = Object.freeze({
      id: "stars",
      type: "canvas",
      props: Object.freeze({}),
      children: Object.freeze([]),
      meta: Object.freeze({
        __widget_handler__: def,
        __widget_handler_props__: { max: 5 },
        __widget_handler_state__: { count: 3 },
      }),
    });
    const node: UINode = Object.freeze({
      id: "main",
      type: "window",
      props: Object.freeze({}),
      children: Object.freeze([child]),
    });

    const registry = deriveRegistry(node);
    expect(registry.size).toBe(1);
    expect(registry.has("main\u0000stars")).toBe(true);
    expect(registry.get("main\u0000stars")!.state).toEqual({ count: 3 });
  });

  test("walks children to find nested widgets", () => {
    const def = counterDef();
    const child: UINode = Object.freeze({
      id: "form/stars",
      type: "canvas",
      props: Object.freeze({}),
      children: Object.freeze([]),
      meta: Object.freeze({
        __widget_handler__: def,
        __widget_handler_props__: { max: 5 },
        __widget_handler_state__: { count: 0 },
      }),
    });

    const root: UINode = Object.freeze({
      id: "main",
      type: "window",
      props: Object.freeze({}),
      children: Object.freeze([child]),
    });

    const registry = deriveRegistry(root);
    expect(registry.size).toBe(1);
    expect(registry.has("main\u0000form/stars")).toBe(true);
  });
});
