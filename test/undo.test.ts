import { afterEach, describe, expect, test } from "vitest";
import { UndoStack } from "../src/index.js";

afterEach(() => {
  UndoStack._resetTimestampFn();
});

describe("UndoStack", () => {
  test("createUndoStack sets initial model", () => {
    const stack = UndoStack.createUndoStack(0);
    expect(UndoStack.current(stack)).toBe(0);
    expect(UndoStack.canUndo(stack)).toBe(false);
    expect(UndoStack.canRedo(stack)).toBe(false);
  });

  test("createUndoStack accepts max_size option", () => {
    const stack = UndoStack.createUndoStack(0, { max_size: 3 });
    expect(stack.max_size).toBe(3);
    expect(stack.undo_size).toBe(0);
  });

  test("createUndoStack rejects invalid max_size", () => {
    expect(() => UndoStack.createUndoStack(0, { max_size: 0 })).toThrow();
    expect(() => UndoStack.createUndoStack(0, { max_size: -1 })).toThrow();
    expect(() => UndoStack.createUndoStack(0, { max_size: 1.5 })).toThrow();
  });

  test("push updates the model and enables undo", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    expect(UndoStack.current(stack)).toBe(1);
    expect(UndoStack.canUndo(stack)).toBe(true);
  });

  test("undo reverses the last command", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    stack = UndoStack.undo(stack);
    expect(UndoStack.current(stack)).toBe(0);
    expect(UndoStack.canRedo(stack)).toBe(true);
  });

  test("redo re-applies the last undone command", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    stack = UndoStack.undo(stack);
    stack = UndoStack.redo(stack);
    expect(UndoStack.current(stack)).toBe(1);
  });

  test("pushing a new command clears the redo stack", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    stack = UndoStack.undo(stack);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 10,
      undo: (n) => n - 10,
    });
    expect(UndoStack.current(stack)).toBe(10);
    expect(UndoStack.canRedo(stack)).toBe(false);
  });

  test("undo on empty stack returns unchanged", () => {
    const stack = UndoStack.createUndoStack(42);
    const same = UndoStack.undo(stack);
    expect(same).toBe(stack);
  });

  test("redo on empty stack returns unchanged", () => {
    const stack = UndoStack.createUndoStack(42);
    const same = UndoStack.redo(stack);
    expect(same).toBe(stack);
  });

  test("history returns labels most recent first", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
      label: "increment",
    });
    stack = UndoStack.push(stack, {
      apply: (n) => n * 2,
      undo: (n) => n / 2,
      label: "double",
    });
    expect(UndoStack.history(stack)).toEqual(["double", "increment"]);
  });

  test("coalescing merges commands within the time window", () => {
    let time = 0;
    UndoStack._setTimestampFn(() => time);

    let stack = UndoStack.createUndoStack("");
    stack = UndoStack.push(stack, {
      apply: (s) => s + "a",
      undo: () => "",
      coalesce: "typing",
      coalesceWindowMs: 500,
      label: "type",
    });

    time = 100;
    stack = UndoStack.push(stack, {
      apply: (s) => s + "b",
      undo: (s) => s.slice(0, -1),
      coalesce: "typing",
      coalesceWindowMs: 500,
    });

    expect(UndoStack.current(stack)).toBe("ab");
    expect(UndoStack.history(stack)).toHaveLength(1);

    stack = UndoStack.undo(stack);
    expect(UndoStack.current(stack)).toBe("");
  });

  test("coalescing does not merge when window expires", () => {
    let time = 0;
    UndoStack._setTimestampFn(() => time);

    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
      coalesce: "inc",
      coalesceWindowMs: 100,
    });

    time = 200;
    stack = UndoStack.push(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
      coalesce: "inc",
      coalesceWindowMs: 100,
    });

    expect(UndoStack.history(stack)).toHaveLength(2);
  });

  test("max_size drops oldest entries when exceeded", () => {
    let stack = UndoStack.createUndoStack(0, { max_size: 3 });

    for (let i = 1; i <= 5; i++) {
      stack = UndoStack.push(stack, {
        apply: (n) => n + 1,
        undo: (n) => n - 1,
        label: `step-${i}`,
      });
    }

    expect(UndoStack.current(stack)).toBe(5);
    expect(stack.undo_size).toBe(3);
    expect(UndoStack.history(stack)).toEqual(["step-5", "step-4", "step-3"]);

    stack = UndoStack.undo(stack);
    expect(UndoStack.current(stack)).toBe(4);
    expect(stack.undo_size).toBe(2);

    stack = UndoStack.undo(stack);
    stack = UndoStack.undo(stack);
    expect(UndoStack.current(stack)).toBe(2);
    expect(UndoStack.canUndo(stack)).toBe(false);
  });

  test("max_size is preserved across undo and redo", () => {
    let stack = UndoStack.createUndoStack(0, { max_size: 2 });
    stack = UndoStack.push(stack, { apply: (n) => n + 1, undo: (n) => n - 1 });
    stack = UndoStack.push(stack, { apply: (n) => n + 1, undo: (n) => n - 1 });

    stack = UndoStack.undo(stack);
    expect(stack.max_size).toBe(2);

    stack = UndoStack.redo(stack);
    expect(stack.max_size).toBe(2);
  });
});
