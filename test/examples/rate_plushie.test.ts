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
    expect(init["toggleProgress"]).toBe(0.0);
    expect(init["toggleTarget"]).toBe(0.0);
    expect(Array.isArray(init["reviews"])).toBe(true);
    expect((init["reviews"] as unknown[]).length).toBeGreaterThan(0);
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

  test("has conditional subscriptions for animation", () => {
    expect(ratePlushie.config.subscriptions).toBeTypeOf("function");

    // No animation when at rest
    const init = ratePlushie.config.init as Record<string, unknown>;
    const subs = ratePlushie.config.subscriptions!(init as any);
    expect(subs).toHaveLength(0);

    // Animating when progress != target
    const animating = { ...init, toggleTarget: 1.0 };
    const animSubs = ratePlushie.config.subscriptions!(animating as any);
    expect(animSubs.length).toBeGreaterThan(0);
  });
});
