/**
 * plushie -- Native desktop GUI framework for TypeScript.
 *
 * This is the main entry point. It provides:
 *
 * - {@link app} -- create an application definition (init/view/update)
 * - {@link Command} -- pure-data side effects (async, focus, scroll, exit, etc.)
 * - {@link Subscription} -- declarative event sources (timers, key/mouse events)
 * - Event type guards -- `isClick`, `isTimer`, `isAsync`, etc. for narrowing events
 * - Core types -- `UINode`, `Event`, `Handler`, `DeepReadonly`, etc.
 *
 * Widget builders live in the `plushie/ui` subpath export.
 * Testing helpers live in `plushie/testing`.
 *
 * @example
 * ```ts
 * import { app, Command, Subscription, isTimer } from 'plushie'
 * import { window, column, text, button } from 'plushie/ui'
 * ```
 *
 * @module
 */

// Core framework exports.

export { app } from "./app.js"
export type { AppConfig, AppDefinition, AppSettings } from "./app.js"

// Command constructors as a namespace-style object.
import * as Command from "./command.js"
export { Command }

// Subscription constructors as a namespace-style object.
import * as Subscription from "./subscription.js"
export { Subscription }

// Event type guards.
export {
  isClick,
  isInput,
  isSubmit,
  isToggle,
  isSelect,
  isSlide,
  isWidget,
  isKey,
  isModifiers,
  isMouse,
  isTouch,
  isIme,
  isWindow,
  isCanvas,
  isMouseArea,
  isPane,
  isSensor,
  isEffect,
  isSystem,
  isTimer,
  isAsync,
  isStream,
  target,
} from "./events.js"

// Core types.
export type {
  UINode,
  Command as CommandType,
  Subscription as SubscriptionType,
  Handler,
  UpdateResult,
  DeepReadonly,
  Event,
  WidgetEvent,
  KeyEvent,
  ModifiersEvent,
  MouseEvent,
  TouchEvent,
  ImeEvent,
  WindowEvent,
  CanvasEvent,
  MouseAreaEvent,
  PaneEvent,
  SensorEvent,
  EffectEvent,
  SystemEvent,
  TimerEvent,
  AsyncEvent,
  StreamEvent,
  Modifiers,
} from "./types.js"

export { COMMAND } from "./types.js"

// Effects as a namespace-style object.
import * as Effects from "./effects.js"
export { Effects }

// Animation functions.
export {
  linear,
  easeIn,
  easeOut,
  easeInOut,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  spring,
  createAnimation,
  startAnimation,
  advanceAnimation,
  animationValue,
  animationFinished,
  interpolate,
} from "./animation.js"
export type { Animation, EasingFn, AdvanceResult } from "./animation.js"

// Selection state.
import * as Selection from "./selection.js"
export { Selection }
export type { Selection as SelectionType } from "./selection.js"

// Undo/redo stack.
import * as UndoStack from "./undo.js"
export { UndoStack }
export type { UndoStack as UndoStackType, UndoCommand } from "./undo.js"

// Client-side routing.
import * as Route from "./route.js"
export { Route }
export type { Route as RouteType, RouteEntry } from "./route.js"

// Query pipeline.
import * as Data from "./data.js"
export { Data }
export type { QueryOptions, QueryResult, SortSpec } from "./data.js"

// Keyboard key constants.
import * as Keys from "./keys.js"
export { Keys }
