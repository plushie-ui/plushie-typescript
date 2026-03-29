import { describe, expect, test } from "vitest";
import notes from "../../examples/notes.js";

describe("notes example", () => {
  test("exports a valid app definition", () => {
    expect(notes.config).toBeDefined();
    expect(notes.config.view).toBeTypeOf("function");
    expect(notes.run).toBeTypeOf("function");
  });

  test("init produces correct model shape", () => {
    const init = notes.config.init as unknown as Record<string, unknown>;
    expect(init).toHaveProperty("notes");
    expect(init).toHaveProperty("nextId");
    expect(init).toHaveProperty("searchQuery");
    expect(init).toHaveProperty("selection");
    expect(init).toHaveProperty("undo");
    expect(init).toHaveProperty("route");
  });

  test("view produces a UINode tree", () => {
    const model = notes.config.init;
    const tree = notes.config.view(model as any);
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true);
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window");
    }
  });

  test("has update for event handling", () => {
    expect(notes.config.update).toBeTypeOf("function");
  });
});
