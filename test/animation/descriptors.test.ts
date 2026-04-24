import { describe, expect, test } from "vitest";
import { cubicBezier } from "../../src/animation/easing.js";
import type { SequenceStep } from "../../src/animation/sequence.js";
import { sequence } from "../../src/animation/sequence.js";
import { spring } from "../../src/animation/spring.js";
import { ANIMATION_DESCRIPTOR, loop, transition } from "../../src/animation/transition.js";
import type { UINode } from "../../src/types.js";
import { mergeAnimationProps, withAnimation } from "../../src/ui/build.js";

describe("transition", () => {
  test("creates a frozen descriptor with defaults", () => {
    const t = transition({ to: 1, duration: 300 });
    expect(t.type).toBe("transition");
    expect(t.to).toBe(1);
    expect(t.duration).toBe(300);
    expect(t.easing).toBe("ease_in_out");
    expect(t.delay).toBe(0);
    expect(t[ANIMATION_DESCRIPTOR]).toBe(true);
    expect(Object.isFrozen(t)).toBe(true);
  });

  test("accepts all options", () => {
    const t = transition({
      to: 0,
      duration: 200,
      easing: "ease_out",
      delay: 100,
      from: 1,
      repeat: 3,
      autoReverse: true,
      onComplete: "faded",
    });
    expect(t.easing).toBe("ease_out");
    expect(t.delay).toBe(100);
    expect(t.from).toBe(1);
    expect(t.repeat).toBe(3);
    expect(t.auto_reverse).toBe(true);
    expect(t.on_complete).toBe("faded");
  });

  test("cubic bezier easing", () => {
    const t = transition({ to: 1, duration: 300, easing: cubicBezier(0.4, 0, 0.2, 1) });
    expect(t.easing).toEqual({ cubic_bezier: [0.4, 0, 0.2, 1] });
  });

  test("repeat sets repeat count", () => {
    const t = transition({ to: 1, duration: 300, repeat: 5 });
    expect(t.repeat).toBe(5);
  });

  test("rejects negative duration", () => {
    expect(() => transition({ to: 1, duration: -1 })).toThrow(
      "duration must be a positive integer",
    );
  });

  test("rejects zero duration", () => {
    expect(() => transition({ to: 1, duration: 0 })).toThrow("duration must be a positive integer");
  });

  test("rejects float duration", () => {
    expect(() => transition({ to: 1, duration: 100.5 })).toThrow(
      "duration must be a positive integer",
    );
  });

  test("rejects non-finite duration", () => {
    expect(() => transition({ to: 1, duration: Infinity })).toThrow(
      "duration must be a positive integer",
    );
  });

  test("rejects non-number duration", () => {
    expect(() => transition({ to: 1, duration: "fast" as unknown as number })).toThrow(
      "duration must be a positive integer",
    );
  });
});

describe("loop", () => {
  test("defaults to forever repeat with auto-reverse", () => {
    const l = loop({ to: 0.4, from: 1, duration: 800 });
    expect(l.type).toBe("transition");
    expect(l.repeat).toBe("forever");
    expect(l.auto_reverse).toBe(true);
  });

  test("finite repeat count", () => {
    const l = loop({ to: 0.4, from: 1, duration: 800, repeat: 3 });
    expect(l.repeat).toBe(3);
  });

  test("autoReverse: false disables auto-reverse", () => {
    const l = loop({ to: 360, from: 0, duration: 1000, autoReverse: false });
    expect(l.auto_reverse).toBe(false);
  });

  test("reverse remains a compatibility alias", () => {
    const l = loop({ to: 360, from: 0, duration: 1000, reverse: false });
    expect(l.auto_reverse).toBe(false);
  });

  test("autoReverse wins over reverse when both are provided", () => {
    expect(() =>
      loop({ to: 360, from: 0, duration: 1000, autoReverse: true, reverse: false }),
    ).toThrow("use autoReverse instead of mixing autoReverse and reverse");
  });
});

describe("spring", () => {
  test("creates a frozen descriptor with defaults", () => {
    const s = spring({ to: 1.05 });
    expect(s.type).toBe("spring");
    expect(s.to).toBe(1.05);
    expect(s.stiffness).toBe(100);
    expect(s.damping).toBe(10);
    expect(s.mass).toBe(1);
    expect(s.velocity).toBe(0);
    expect(s[ANIMATION_DESCRIPTOR]).toBe(true);
    expect(Object.isFrozen(s)).toBe(true);
  });

  test("named presets override defaults", () => {
    const s = spring({ to: 1, preset: "bouncy" });
    expect(s.stiffness).toBe(300);
    expect(s.damping).toBe(10);
  });

  test("explicit values override preset", () => {
    const s = spring({ to: 1, preset: "bouncy", stiffness: 500 });
    expect(s.stiffness).toBe(500);
    expect(s.damping).toBe(10);
  });

  test("all presets produce valid descriptors", () => {
    for (const preset of ["gentle", "bouncy", "stiff", "snappy", "molasses"] as const) {
      const s = spring({ to: 1, preset });
      expect(s.type).toBe("spring");
      expect(s.stiffness).toBeGreaterThan(0);
      expect(s.damping).toBeGreaterThan(0);
    }
  });

  test("from and onComplete", () => {
    const s = spring({ to: 1, from: 0, onComplete: "settled" });
    expect(s.from).toBe(0);
    expect(s.on_complete).toBe("settled");
  });

  test("rejects non-positive stiffness", () => {
    expect(() => spring({ to: 1, stiffness: -1 })).toThrow("stiffness must be a positive");
    expect(() => spring({ to: 1, stiffness: 0 })).toThrow("stiffness must be a positive");
  });

  test("rejects non-positive mass", () => {
    expect(() => spring({ to: 1, mass: 0 })).toThrow("mass must be a positive");
  });
});

describe("sequence", () => {
  test("chains steps", () => {
    const s = sequence({
      steps: [transition({ to: 1, from: 0, duration: 200 }), transition({ to: 0, duration: 300 })],
    });
    expect(s.type).toBe("sequence");
    expect(s.steps).toHaveLength(2);
    expect(s[ANIMATION_DESCRIPTOR]).toBe(true);
    expect(Object.isFrozen(s)).toBe(true);
  });

  test("onComplete on sequence", () => {
    const s = sequence({
      steps: [transition({ to: 1, duration: 100 })],
      onComplete: "done",
    });
    expect(s.on_complete).toBe("done");
  });

  test("mixed transitions and springs", () => {
    const s = sequence({
      steps: [transition({ to: 1, from: 0, duration: 200 }), spring({ to: 0, preset: "bouncy" })],
    });
    expect(s.steps[0]!.type).toBe("transition");
    expect(s.steps[1]!.type).toBe("spring");
  });

  test("rejects empty steps array", () => {
    expect(() => sequence({ steps: [] })).toThrow("non-empty array");
  });

  test("rejects non-descriptor steps", () => {
    expect(() => sequence({ steps: [{ to: 1 }] as unknown as readonly SequenceStep[] })).toThrow(
      "not an animation descriptor",
    );
  });
});

describe("cubicBezier", () => {
  test("creates a frozen bezier spec", () => {
    const b = cubicBezier(0.4, 0, 0.2, 1);
    expect(b.cubic_bezier).toEqual([0.4, 0, 0.2, 1]);
    expect(Object.isFrozen(b)).toBe(true);
  });
});

describe("withAnimation", () => {
  const node: UINode = Object.freeze({
    id: "panel",
    type: "container",
    props: Object.freeze({ padding: 16 }),
    children: Object.freeze([]) as readonly UINode[],
  });

  test("merges animation props onto node", () => {
    const t = transition({ to: 1, from: 0, duration: 200 });
    const animated = withAnimation(node, { opacity: t });
    expect(animated.props["padding"]).toBe(16);
    expect(animated.props["opacity"]).toBe(t);
    expect(Object.isFrozen(animated)).toBe(true);
    expect(Object.isFrozen(animated.props)).toBe(true);
  });

  test("does not mutate original node", () => {
    withAnimation(node, { opacity: transition({ to: 0, duration: 100 }) });
    expect(node.props["opacity"]).toBeUndefined();
  });

  test("sets exit prop", () => {
    const animated = withAnimation(
      node,
      { opacity: transition({ to: 1, from: 0, duration: 200 }) },
      { opacity: transition({ to: 0, duration: 150 }) },
    );
    expect(animated.props["exit"]).toBeDefined();
    const exit = animated.props["exit"] as Record<string, unknown>;
    expect((exit["opacity"] as Record<string, unknown>)["type"]).toBe("transition");
  });

  test("works with spring descriptors", () => {
    const s = spring({ to: 1.05, preset: "bouncy" });
    const animated = withAnimation(node, { scale: s });
    expect(animated.props["scale"]).toBe(s);
  });

  test("rejects non-descriptor animate values", () => {
    expect(() => withAnimation(node, { opacity: { to: 1 } })).toThrow(
      "animate.opacity is not an animation descriptor",
    );
  });

  test("rejects non-descriptor exit values", () => {
    expect(() =>
      withAnimation(
        node,
        { opacity: transition({ to: 1, from: 0, duration: 200 }) },
        { opacity: { to: 0 } },
      ),
    ).toThrow("exit.opacity is not an animation descriptor");
  });

  test("mergeAnimationProps validates descriptor values", () => {
    const props: Record<string, unknown> = {};
    const fadeIn = transition({ to: 1, from: 0, duration: 200 });
    const fadeOut = transition({ to: 0, duration: 150 });

    mergeAnimationProps(props, {
      animate: { opacity: fadeIn },
      exit: { opacity: fadeOut },
    });

    expect(props["opacity"]).toBe(fadeIn);
    expect(props["exit"]).toEqual({ opacity: fadeOut });
    expect(() => mergeAnimationProps({}, { animate: { opacity: { to: 1 } } })).toThrow(
      "animate.opacity is not an animation descriptor",
    );
  });
});
