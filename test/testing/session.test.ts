import { describe, expect, test, vi } from "vitest";
import { TestSession } from "../../src/testing/session.js";

function createSessionDouble(): {
  session: TestSession<unknown>;
  interact: ReturnType<typeof vi.fn>;
} {
  const session = Object.create(TestSession.prototype) as TestSession<unknown>;
  const interact = vi.fn().mockResolvedValue(undefined);
  const stubbed = session as unknown as {
    runtime: { tree: () => null };
    interact: typeof interact;
  };
  stubbed.runtime = { tree: () => null };
  stubbed.interact = interact;
  return { session, interact };
}

describe("TestSession canvas helpers", () => {
  test("send canonical canvas action names", async () => {
    const { session, interact } = createSessionDouble();

    await session.canvasPress("canvas", 10, 20, "left");
    await session.canvasRelease("canvas", 30, 40, "right");
    await session.canvasMove("canvas", 50, 60);
    await session.canvasMove("main#canvas/overlay", 70, 80);

    expect(interact).toHaveBeenNthCalledWith(
      1,
      "canvas_press",
      { by: "id", value: "canvas" },
      { x: 10, y: 20, button: "left" },
    );
    expect(interact).toHaveBeenNthCalledWith(
      2,
      "canvas_release",
      { by: "id", value: "canvas" },
      { x: 30, y: 40, button: "right" },
    );
    expect(interact).toHaveBeenNthCalledWith(
      3,
      "canvas_move",
      { by: "id", value: "canvas" },
      { x: 50, y: 60 },
    );
    expect(interact).toHaveBeenNthCalledWith(
      4,
      "canvas_move",
      { by: "id", value: "canvas/overlay", window_id: "main" },
      { x: 70, y: 80 },
    );
  });

  test("keeps key press and release actions unchanged", async () => {
    const { session, interact } = createSessionDouble();

    await session.press("enter");
    await session.release("enter");

    expect(interact).toHaveBeenNthCalledWith(1, "press", {}, { key: "Enter" });
    expect(interact).toHaveBeenNthCalledWith(2, "release", {}, { key: "Enter" });
  });
});
