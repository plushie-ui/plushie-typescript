import { describe, expect, test } from "vitest";
import {
  advanceAnimation,
  animationFinished,
  animationValue,
  createAnimation,
  easeIn,
  easeInOut,
  easeInOutQuad,
  easeInQuad,
  easeOut,
  easeOutQuad,
  interpolate,
  linear,
  looping,
  springEase,
  startAnimation,
} from "../src/index.js";

describe("easing functions", () => {
  test("linear returns t unchanged", () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.5)).toBe(0.5);
    expect(linear(1)).toBe(1);
  });

  test("easeIn is cubic", () => {
    expect(easeIn(0)).toBe(0);
    expect(easeIn(0.5)).toBeCloseTo(0.125);
    expect(easeIn(1)).toBe(1);
  });

  test("easeOut is cubic", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(0.5)).toBeCloseTo(0.875);
    expect(easeOut(1)).toBe(1);
  });

  test("easeInOut is cubic", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.25)).toBeCloseTo(0.0625);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
  });

  test("easeInQuad is quadratic", () => {
    expect(easeInQuad(0.5)).toBeCloseTo(0.25);
  });

  test("easeOutQuad is quadratic", () => {
    expect(easeOutQuad(0.5)).toBeCloseTo(0.75);
  });

  test("easeInOutQuad transitions smoothly", () => {
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(0.25)).toBeCloseTo(0.125);
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5);
    expect(easeInOutQuad(1)).toBe(1);
  });

  test("spring overshoots then settles", () => {
    expect(springEase(0)).toBe(0);
    expect(springEase(1)).toBe(1);
    // Mid-animation should overshoot past 1
    const mid = springEase(0.5);
    expect(mid).toBeGreaterThan(0.9);
  });

  test("all easings return 0 at t=0 and 1 at t=1", () => {
    const fns = [
      linear,
      easeIn,
      easeOut,
      easeInOut,
      easeInQuad,
      easeOutQuad,
      easeInOutQuad,
      springEase,
    ];
    for (const fn of fns) {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    }
  });
});

describe("interpolate", () => {
  test("lerps between two values", () => {
    expect(interpolate(0, 100, 0.5)).toBe(50);
    expect(interpolate(10, 20, 0)).toBe(10);
    expect(interpolate(10, 20, 1)).toBe(20);
  });

  test("clamps t to 0..1", () => {
    expect(interpolate(0, 100, -1)).toBe(0);
    expect(interpolate(0, 100, 2)).toBe(100);
  });

  test("applies easing function", () => {
    expect(interpolate(0, 100, 0.5, easeIn)).toBeCloseTo(12.5);
  });
});

describe("animation lifecycle", () => {
  test("create sets initial value to from", () => {
    const anim = createAnimation(0, 100, 1000);
    expect(animationValue(anim)).toBe(0);
    expect(animationFinished(anim)).toBe(false);
  });

  test("create rejects zero duration", () => {
    expect(() => createAnimation(0, 100, 0)).toThrow("duration must be a positive integer");
  });

  test("create rejects float duration", () => {
    expect(() => createAnimation(0, 100, 100.5)).toThrow("duration must be a positive integer");
  });

  test("create rejects negative duration", () => {
    expect(() => createAnimation(0, 100, -1)).toThrow("duration must be a positive integer");
  });

  test("create rejects non-finite duration", () => {
    expect(() => createAnimation(0, 100, Number.POSITIVE_INFINITY)).toThrow(
      "duration must be a positive integer",
    );
  });

  test("looping rejects zero duration", () => {
    expect(() => looping(0, 100, 0)).toThrow("duration must be a positive integer");
  });

  test("looping rejects negative duration", () => {
    expect(() => looping(0, 100, -1)).toThrow("duration must be a positive integer");
  });

  test("looping rejects float duration", () => {
    expect(() => looping(0, 100, 100.5)).toThrow("duration must be a positive integer");
  });

  test("looping rejects non-finite duration", () => {
    expect(() => looping(0, 100, Number.POSITIVE_INFINITY)).toThrow(
      "duration must be a positive integer",
    );
  });

  test("start resets to from and records timestamp", () => {
    const anim = createAnimation(10, 50, 500);
    const started = startAnimation(anim, 1000);
    expect(started.startedAt).toBe(1000);
    expect(animationValue(started)).toBe(10);
  });

  test("advance interpolates over time", () => {
    const anim = startAnimation(createAnimation(0, 100, 1000), 0);
    const r = advanceAnimation(anim, 500);
    expect(r.value).toBeCloseTo(50);
    expect(r.finished).toBe(false);
  });

  test("advance finishes at end of duration", () => {
    const anim = startAnimation(createAnimation(0, 100, 1000), 0);
    const r = advanceAnimation(anim, 1000);
    expect(r.value).toBe(100);
    expect(r.finished).toBe(true);
  });

  test("advance past duration clamps to final value", () => {
    const anim = startAnimation(createAnimation(0, 100, 1000), 0);
    const r = advanceAnimation(anim, 2000);
    expect(r.value).toBe(100);
    expect(r.finished).toBe(true);
  });

  test("advance before start returns initial value", () => {
    const anim = createAnimation(0, 100, 1000);
    const r = advanceAnimation(anim, 500);
    expect(r.value).toBe(0);
    expect(r.finished).toBe(false);
  });

  test("custom easing is applied during animation", () => {
    const anim = startAnimation(createAnimation(0, 100, 1000, { easing: easeIn }), 0);
    const r = advanceAnimation(anim, 500);
    expect(r.value).toBeCloseTo(12.5);
  });

  test("animationFinished returns true when value equals to", () => {
    const anim = startAnimation(createAnimation(0, 100, 1000), 0);
    const r = advanceAnimation(anim, 1000);
    expect(animationFinished(r.animation)).toBe(true);
  });
});
