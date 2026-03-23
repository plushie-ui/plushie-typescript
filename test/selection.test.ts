import { describe, expect, test } from "vitest";
import { Selection } from "../src/index.js";

describe("Selection", () => {
  test("createSelection defaults to single mode with empty set", () => {
    const sel = Selection.createSelection();
    expect(sel.mode).toBe("single");
    expect(sel.selected.size).toBe(0);
    expect(sel.anchor).toBeNull();
  });

  test("select in single mode replaces selection", () => {
    let sel = Selection.createSelection();
    sel = Selection.select(sel, "a");
    sel = Selection.select(sel, "b");
    expect(Selection.isSelected(sel, "a")).toBe(false);
    expect(Selection.isSelected(sel, "b")).toBe(true);
  });

  test("select in multi mode without extend replaces", () => {
    let sel = Selection.createSelection({ mode: "multi" });
    sel = Selection.select(sel, "a");
    sel = Selection.select(sel, "b");
    expect(sel.selected.size).toBe(1);
    expect(Selection.isSelected(sel, "b")).toBe(true);
  });

  test("select in multi mode with extend adds", () => {
    let sel = Selection.createSelection({ mode: "multi" });
    sel = Selection.select(sel, "a");
    sel = Selection.select(sel, "b", { extend: true });
    expect(sel.selected.size).toBe(2);
    expect(Selection.isSelected(sel, "a")).toBe(true);
    expect(Selection.isSelected(sel, "b")).toBe(true);
  });

  test("toggle adds and removes in single mode", () => {
    let sel = Selection.createSelection();
    sel = Selection.toggle(sel, "a");
    expect(Selection.isSelected(sel, "a")).toBe(true);
    sel = Selection.toggle(sel, "a");
    expect(sel.selected.size).toBe(0);
    expect(sel.anchor).toBeNull();
  });

  test("toggle in multi mode adds and removes without clearing", () => {
    let sel = Selection.createSelection({ mode: "multi" });
    sel = Selection.select(sel, "a");
    sel = Selection.select(sel, "b", { extend: true });
    sel = Selection.toggle(sel, "a");
    expect(Selection.isSelected(sel, "a")).toBe(false);
    expect(Selection.isSelected(sel, "b")).toBe(true);
  });

  test("deselect removes a specific item", () => {
    let sel = Selection.createSelection({ mode: "multi" });
    sel = Selection.select(sel, "a");
    sel = Selection.select(sel, "b", { extend: true });
    sel = Selection.deselect(sel, "a");
    expect(Selection.isSelected(sel, "a")).toBe(false);
    expect(Selection.isSelected(sel, "b")).toBe(true);
  });

  test("clear empties selection and resets anchor", () => {
    let sel = Selection.createSelection({ mode: "multi" });
    sel = Selection.select(sel, "a");
    sel = Selection.clear(sel);
    expect(sel.selected.size).toBe(0);
    expect(sel.anchor).toBeNull();
  });

  test("rangeSelect selects contiguous items from anchor", () => {
    let sel = Selection.createSelection({
      mode: "range",
      order: ["a", "b", "c", "d", "e"],
    });
    sel = Selection.select(sel, "b");
    sel = Selection.rangeSelect(sel, "d");
    expect(Selection.selected(sel)).toEqual(new Set(["b", "c", "d"]));
  });

  test("rangeSelect with no anchor selects only the target", () => {
    let sel = Selection.createSelection({
      mode: "range",
      order: ["a", "b", "c"],
    });
    sel = Selection.rangeSelect(sel, "b");
    expect(sel.selected.size).toBe(1);
    expect(Selection.isSelected(sel, "b")).toBe(true);
  });

  test("rangeSelect works in reverse direction", () => {
    let sel = Selection.createSelection({
      mode: "range",
      order: ["a", "b", "c", "d", "e"],
    });
    sel = Selection.select(sel, "d");
    sel = Selection.rangeSelect(sel, "b");
    expect(Selection.selected(sel)).toEqual(new Set(["b", "c", "d"]));
  });

  test("rangeSelect falls back to single when id not in order", () => {
    let sel = Selection.createSelection({
      mode: "range",
      order: ["a", "b", "c"],
    });
    sel = Selection.select(sel, "a");
    sel = Selection.rangeSelect(sel, "z");
    expect(sel.selected.size).toBe(1);
    expect(Selection.isSelected(sel, "z")).toBe(true);
  });
});
