import { describe, expect, test } from "vitest";
import colorPicker from "../../examples/color_picker.js";

describe("color_picker example", () => {
  test("exports a valid app definition", () => {
    expect(colorPicker.config).toBeDefined();
    expect(colorPicker.config.view).toBeTypeOf("function");
    expect(colorPicker.run).toBeTypeOf("function");
  });

  test("init produces correct model shape", () => {
    const init = colorPicker.config.init as unknown as Record<string, unknown>;
    expect(init).toHaveProperty("hue");
    expect(init).toHaveProperty("saturation");
    expect(init).toHaveProperty("value");
    expect(init["hue"]).toBeTypeOf("number");
    expect(init["saturation"]).toBeTypeOf("number");
    expect(init["value"]).toBeTypeOf("number");
  });

  test("view produces a UINode tree with canvas", () => {
    const model = colorPicker.config.init;
    const tree = colorPicker.config.view(model as any);
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true);
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window");
      expect(tree.id).toBe("color_picker");
    }
  });

  test("has update for widget event handling", () => {
    expect(colorPicker.config.update).toBeTypeOf("function");
  });
});
