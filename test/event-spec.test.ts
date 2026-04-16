import { describe, expect, test } from "vitest";
import { builtinSpec, validateEmitData, validateFieldType } from "../src/event-spec.js";

describe("builtinSpec", () => {
  test("returns spec for known event types", () => {
    expect(builtinSpec("click")).toEqual({ carrier: "none" });
    expect(builtinSpec("input")).toEqual({ carrier: "value", type: "string" });
    expect(builtinSpec("toggle")).toEqual({ carrier: "value", type: "boolean" });
    expect(builtinSpec("slide")).toEqual({ carrier: "value", type: "float" });
  });

  test("returns undefined for unknown event types", () => {
    expect(builtinSpec("custom_event")).toBeUndefined();
  });

  test("structured events have fields", () => {
    const spec = builtinSpec("drag");
    expect(spec).toBeDefined();
    if (spec && "fields" in spec) {
      expect(spec.fields).toBeDefined();
      expect(spec.fields!.length).toBeGreaterThan(0);
    }
  });

  test("key_press has required fields", () => {
    const spec = builtinSpec("key_press");
    expect(spec).toBeDefined();
    if (spec && "required" in spec) {
      expect(spec.required).toContain("key");
      expect(spec.required).toContain("modifiers");
    }
  });
});

describe("validateFieldType", () => {
  test("float accepts numbers", () => {
    expect(validateFieldType(42, "float")).toBe(true);
    expect(validateFieldType(3.14, "float")).toBe(true);
    expect(validateFieldType("hi", "float")).toBe(false);
  });

  test("string accepts strings", () => {
    expect(validateFieldType("hello", "string")).toBe(true);
    expect(validateFieldType(42, "string")).toBe(false);
  });

  test("boolean accepts booleans", () => {
    expect(validateFieldType(true, "boolean")).toBe(true);
    expect(validateFieldType(1, "boolean")).toBe(false);
  });

  test("any accepts everything", () => {
    expect(validateFieldType(42, "any")).toBe(true);
    expect(validateFieldType("hi", "any")).toBe(true);
    expect(validateFieldType(null, "any")).toBe(true);
  });
});

describe("validateEmitData", () => {
  test("none carrier rejects data", () => {
    expect(validateEmitData("click", "something")).toBeTruthy();
  });

  test("none carrier accepts null/undefined", () => {
    expect(validateEmitData("click", null)).toBeNull();
    expect(validateEmitData("click", undefined)).toBeNull();
  });

  test("scalar carrier validates type", () => {
    expect(validateEmitData("input", "hello")).toBeNull();
    expect(validateEmitData("input", 42)).toBeTruthy();
    expect(validateEmitData("slide", 3.14)).toBeNull();
    expect(validateEmitData("toggle", true)).toBeNull();
    expect(validateEmitData("toggle", "yes")).toBeTruthy();
  });

  test("scalar carrier rejects null", () => {
    expect(validateEmitData("input", null)).toBeTruthy();
  });

  test("structured carrier validates required fields", () => {
    const err = validateEmitData("key_press", { key: "Enter", modifiers: [] });
    expect(err).toBeNull();
  });

  test("structured carrier rejects missing required fields", () => {
    const err = validateEmitData("key_press", { key: "Enter" });
    expect(err).toContain("missing required field");
  });

  test("structured carrier validates field types", () => {
    const err = validateEmitData("resize", { width: "not a number", height: 100 });
    expect(err).toContain("must be float");
  });

  test("structured carrier accepts all fields present", () => {
    const err = validateEmitData("resize", { width: 800, height: 600 });
    expect(err).toBeNull();
  });

  test("returns null for unknown events without custom spec", () => {
    expect(validateEmitData("custom", { foo: 1 })).toBeNull();
  });

  test("optional fields can be omitted when required list is explicit", () => {
    const err = validateEmitData("enter", {});
    expect(err).toBeNull();
  });
});
