import { describe, expect, test } from "vitest";
import { resolveA11yForNode } from "../src/testing/session.js";

describe("resolveA11yForNode", () => {
  test("text_input placeholder seeds description", () => {
    expect(resolveA11yForNode("text_input", { placeholder: "Search..." })).toEqual({
      description: "Search...",
    });
  });

  test("image alt seeds label", () => {
    expect(resolveA11yForNode("image", { alt: "Tree" })).toEqual({ label: "Tree" });
  });

  test("explicit a11y composes with inferred values", () => {
    const props = {
      placeholder: "Search...",
      a11y: { label: "Search box", required: true },
    };
    const resolved = resolveA11yForNode("text_input", props);
    expect(resolved).toEqual({
      description: "Search...",
      label: "Search box",
      required: true,
    });
  });

  test("explicit description overrides inferred", () => {
    const props = {
      placeholder: "Search...",
      a11y: { description: "Enter a query" },
    };
    expect(resolveA11yForNode("text_input", props)).toEqual({
      description: "Enter a query",
    });
  });

  test("blank placeholder is treated as absent", () => {
    expect(resolveA11yForNode("text_input", { placeholder: "" })).toEqual({});
  });

  test("unknown widget type returns empty", () => {
    expect(resolveA11yForNode("text", { content: "hi" })).toEqual({});
  });
});
