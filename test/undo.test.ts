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

  test("applyCommand updates the model and enables undo", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    expect(UndoStack.current(stack)).toBe(1);
    expect(UndoStack.canUndo(stack)).toBe(true);
  });

  test("undo reverses the last command", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    stack = UndoStack.undo(stack);
    expect(UndoStack.current(stack)).toBe(0);
    expect(UndoStack.canRedo(stack)).toBe(true);
  });

  test("redo re-applies the last undone command", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    stack = UndoStack.undo(stack);
    stack = UndoStack.redo(stack);
    expect(UndoStack.current(stack)).toBe(1);
  });

  test("applying a new command clears the redo stack", () => {
    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
    });
    stack = UndoStack.undo(stack);
    stack = UndoStack.applyCommand(stack, {
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
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
      label: "increment",
    });
    stack = UndoStack.applyCommand(stack, {
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
    stack = UndoStack.applyCommand(stack, {
      apply: (s) => s + "a",
      undo: () => "",
      coalesce: "typing",
      coalesceWindowMs: 500,
      label: "type",
    });

    time = 100;
    stack = UndoStack.applyCommand(stack, {
      apply: (s) => s + "b",
      undo: (s) => s.slice(0, -1),
      coalesce: "typing",
      coalesceWindowMs: 500,
    });

    expect(UndoStack.current(stack)).toBe("ab");
    // Should be coalesced into one undo entry
    expect(UndoStack.history(stack)).toHaveLength(1);

    // Undo should revert all coalesced changes
    stack = UndoStack.undo(stack);
    expect(UndoStack.current(stack)).toBe("");
  });

  test("coalescing does not merge when window expires", () => {
    let time = 0;
    UndoStack._setTimestampFn(() => time);

    let stack = UndoStack.createUndoStack(0);
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
      coalesce: "inc",
      coalesceWindowMs: 100,
    });

    time = 200;
    stack = UndoStack.applyCommand(stack, {
      apply: (n) => n + 1,
      undo: (n) => n - 1,
      coalesce: "inc",
      coalesceWindowMs: 100,
    });

    expect(UndoStack.history(stack)).toHaveLength(2);
  });
});
