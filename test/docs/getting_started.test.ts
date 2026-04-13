import { expect, test } from "vitest";
import { findById, normalize } from "../../src/tree/index.js";
import { button, column, row, text, window } from "../../src/ui/index.js";

// Code reproduced from docs/getting-started.md counter example

interface Model {
  count: number;
}

const increment = (s: Model): Model => ({ ...s, count: s.count + 1 });
const decrement = (s: Model): Model => ({ ...s, count: s.count - 1 });

function counterView(state: Model) {
  return window("main", { title: "Counter" }, [
    column({ padding: 16, spacing: 8 }, [
      text("count", `Count: ${state.count}`, { size: 20 }),
      row({ spacing: 8 }, [button("increment", "+"), button("decrement", "-")]),
    ]),
  ]);
}

test("getting_started_counter_init", () => {
  const model: Model = { count: 0 };
  expect(model.count).toBe(0);
});

test("getting_started_counter_increment", () => {
  const model = increment({ count: 0 });
  expect(model.count).toBe(1);
});

test("getting_started_counter_decrement", () => {
  const model = decrement({ count: 0 });
  expect(model.count).toBe(-1);
});

test("getting_started_counter_unknown_event", () => {
  // Unknown events should be ignored; model stays unchanged
  const model: Model = { count: 0 };
  expect(model.count).toBe(0);
});

test("getting_started_counter_view", () => {
  const model: Model = { count: 0 };
  const tree = normalize(counterView(model));

  expect(tree.type).toBe("window");
  expect(tree.id).toBe("main");
  expect(tree.props["title"]).toBe("Counter");

  const [col] = tree.children;
  expect(col!.type).toBe("column");
  expect(col!.props["padding"]).toBe(16);
  expect(col!.props["spacing"]).toBe(8);

  const [textNode, rowNode] = col!.children;
  expect(textNode!.type).toBe("text");
  expect(textNode!.props["content"]).toBe("Count: 0");
  expect(textNode!.props["size"]).toBe(20);

  expect(rowNode!.type).toBe("row");
  const [inc, dec] = rowNode!.children;
  expect(inc!.id).toBe("increment");
  expect(inc!.props["label"]).toBe("+");
  expect(dec!.id).toBe("decrement");
  expect(dec!.props["label"]).toBe("-");
});

test("getting_started_counter_view_after_increments", () => {
  let model: Model = { count: 0 };
  model = increment(model);
  model = increment(model);
  const tree = normalize(counterView(model));

  const countNode = findById(tree, "count");
  expect(countNode).not.toBeNull();
  expect(countNode!.props["content"]).toBe("Count: 2");
});
