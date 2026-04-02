/**
 * Animation system.
 *
 * Two layers:
 *
 * **Renderer-side descriptors** (preferred for most use cases):
 * `transition`, `spring`, `sequence`, `loop`. Set these as prop
 * values on widgets. The renderer handles interpolation with zero
 * wire traffic during animation.
 *
 * **SDK-side tween** (manual interpolation):
 * `createAnimation`, `startAnimation`, `advanceAnimation`, etc.
 * For cases where you need frame-by-frame control in TypeScript.
 *
 * @module
 */

export type { CubicBezier, Easing, EasingName } from "./easing.js";
// Renderer-side descriptors
export { cubicBezier } from "./easing.js";
export type { SequenceDescriptor, SequenceOpts, SequenceStep } from "./sequence.js";
export { sequence } from "./sequence.js";
export type { SpringDescriptor, SpringOpts, SpringPreset } from "./spring.js";
export { spring } from "./spring.js";
export type { TransitionDescriptor, TransitionOpts } from "./transition.js";
export { ANIMATION_DESCRIPTOR, loop, transition } from "./transition.js";
export type { AdvanceResult, Animation, EasingFn } from "./tween.js";
// SDK-side tween (manual interpolation)
export {
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
  springEase,
  startAnimation,
} from "./tween.js";
