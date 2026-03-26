import { describe, expect, test } from "vitest";
import ratePlushie from "../../examples/rate_plushie.js";

describe("rate_plushie example", () => {
  test("exports a valid app definition", () => {
    expect(ratePlushie.config).toBeDefined();
    expect(ratePlushie.config.view).toBeTypeOf("function");
    expect(ratePlushie.run).toBeTypeOf("function");
  });

  test("init produces correct model", () => {
    const init = ratePlushie.config.init as Record<string, unknown>;
    expect(init["rating"]).toBe(0);
    expect(init["darkMode"]).toBe(false);
    expect(Array.isArray(init["reviews"])).toBe(true);
    expect((init["reviews"] as unknown[]).length).toBeGreaterThan(0);
    expect(init["errors"]).toEqual({});
  });

  test("view produces a UINode tree", () => {
    const model = ratePlushie.config.init;
    const tree = ratePlushie.config.view(model as any);
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true);
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window");
      expect(tree.id).toBe("main");
    }
  });

  test("has update for event handling", () => {
    expect(ratePlushie.config.update).toBeTypeOf("function");
  });
});
