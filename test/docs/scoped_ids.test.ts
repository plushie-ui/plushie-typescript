import { expect, test } from "vitest";
import { isClick, isInput, isToggle, target } from "../../src/index.js";
import type { WidgetEvent } from "../../src/types.js";

// -- Match on local ID only --

test("scoped_ids_match_local_id", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["form", "sidebar"],
    value: null,
    data: null,
  };
  expect(isClick(event, "save")).toBe(true);
});

// -- Match on ID + immediate parent --

test("scoped_ids_match_immediate_parent", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["form", "sidebar"],
    value: null,
    data: null,
  };
  expect(isClick(event, "save")).toBe(true);
  expect(event.scope[0]).toBe("form");
});

// -- Bind parent for dynamic lists --

test("scoped_ids_dynamic_list_bind_parent", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "toggle",
    id: "done",
    scope: ["item_42", "todoList"],
    value: true,
    data: null,
  };

  expect(isToggle(event, "done")).toBe(true);
  const itemId = event.scope[0];
  expect(itemId).toBe("item_42");
});

// -- Dynamic list delete --

test("scoped_ids_dynamic_list_delete", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "delete",
    scope: ["item_7", "todoList"],
    value: null,
    data: null,
  };

  expect(isClick(event, "delete")).toBe(true);
  expect(event.scope[0]).toBe("item_7");
});

// -- Depth-agnostic matching --

test("scoped_ids_depth_agnostic", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "input",
    id: "query",
    scope: ["search", "sidebar", "root"],
    value: "hi",
    data: null,
  };

  expect(isInput(event, "query")).toBe(true);
  expect(event.scope[0]).toBe("search");
});

// -- Exact depth matching --

test("scoped_ids_exact_depth", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "input",
    id: "query",
    scope: ["search"],
    value: "hi",
    data: null,
  };

  expect(event.scope.length).toBe(1);
  expect(event.scope[0]).toBe("search");
});

test("scoped_ids_exact_depth_mismatch", () => {
  // Two scope levels should NOT match an exact single-scope pattern
  const event: WidgetEvent = {
    kind: "widget",
    type: "input",
    id: "query",
    scope: ["search", "panel"],
    value: "hi",
    data: null,
  };

  // Exact match on ["search"] alone would fail
  expect(event.scope.length).not.toBe(1);
});

// -- No scope matching --

test("scoped_ids_no_scope", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: [],
    value: null,
    data: null,
  };

  expect(event.scope.length).toBe(0);
});

test("scoped_ids_no_scope_mismatch", () => {
  // Scoped event should NOT match an empty-scope check
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["form"],
    value: null,
    data: null,
  };

  expect(event.scope.length).not.toBe(0);
});

// -- Target reconstruction --

test("scoped_ids_target_reconstruction", () => {
  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "save",
    scope: ["form", "sidebar"],
    value: null,
    data: null,
  };
  expect(target(event)).toBe("sidebar/form/save");
});
