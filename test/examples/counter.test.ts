import { describe, expect, test } from "vitest";
import counter from "../../examples/counter.js";
import { findById, normalize } from "../../src/tree/index.js";
import type { UINode } from "../../src/types.js";

describe("counter example", () => {
  test("init produces count: 0", () => {
    expect(counter.config.init).toEqual({ count: 0 });
  });

  test("view produces a window with counter display", () => {
    const model = counter.config.init as { count: number };
    const tree = normalize(counter.config.view(model as never) as UINode);
    expect(tree.type).toBe("window");
    const countNode = findById(tree, "count");
    expect(countNode).not.toBeNull();
    expect(countNode!.props["content"]).toBe("Count: 0");
  });

  test("view shows updated count", () => {
    const tree = normalize(counter.config.view({ count: 5 } as never) as UINode);
    const countNode = findById(tree, "count");
    expect(countNode!.props["content"]).toBe("Count: 5");
  });

  test("view has increment and decrement buttons", () => {
    const tree = normalize(counter.config.view({ count: 0 } as never) as UINode);
    const inc = findById(tree, "increment");
    const dec = findById(tree, "decrement");
    expect(inc).not.toBeNull();
    expect(inc!.type).toBe("button");
    expect(dec).not.toBeNull();
    expect(dec!.type).toBe("button");
  });
});
