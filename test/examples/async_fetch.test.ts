import { describe, expect, test } from "vitest";
import asyncFetch from "../../examples/async_fetch.js";
import { findById, normalize } from "../../src/tree/index.js";
import type { AsyncEvent, UINode, WidgetEvent } from "../../src/types.js";
import { COMMAND } from "../../src/types.js";

const clickEvent = (id: string): WidgetEvent => ({
  kind: "widget",
  type: "click",
  id,
  scope: [],
  value: null,
  data: null,
  windowId: "main",
});

describe("async_fetch example", () => {
  const initModel = asyncFetch.config.init as unknown as Record<string, unknown>;
  const update = asyncFetch.config.update!;

  test("init starts with idle status", () => {
    expect(initModel["status"]).toBe("idle");
    expect(initModel["result"]).toBeNull();
    expect(initModel["error"]).toBeNull();
  });

  test("clicking fetch transitions to loading and returns async command", () => {
    const result = update(initModel as never, clickEvent("fetch"));
    expect(Array.isArray(result)).toBe(true);
    const [model, cmd] = result as unknown as [
      Record<string, unknown>,
      Record<symbol | string, unknown>,
    ];
    expect(model["status"]).toBe("loading");
    expect(cmd[COMMAND]).toBe(true);
    expect(cmd["type"]).toBe("async");
  });

  test("successful async result transitions to done", () => {
    const loading = { ...initModel, status: "loading" };
    const event: AsyncEvent = {
      kind: "async",
      tag: "fetch_result",
      result: { ok: true, value: "fetched data" },
    };
    const result = update(loading as never, event);
    const m = result as unknown as Record<string, unknown>;
    expect(m["status"]).toBe("done");
    expect(m["result"]).toBeDefined();
  });

  test("failed async result transitions to error", () => {
    const loading = { ...initModel, status: "loading" };
    const event: AsyncEvent = {
      kind: "async",
      tag: "fetch_result",
      result: { ok: false, error: "network error" },
    };
    const result = update(loading as never, event);
    const m = result as unknown as Record<string, unknown>;
    expect(m["status"]).toBe("error");
    expect(m["error"]).toBeDefined();
  });

  test("view shows fetch button", () => {
    const tree = normalize(asyncFetch.config.view(initModel as never) as UINode);
    const fetchBtn = findById(tree, "fetch");
    expect(fetchBtn).not.toBeNull();
    expect(fetchBtn!.type).toBe("button");
  });
});
