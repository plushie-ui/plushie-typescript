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

export type { AppConfig, AppDefinition, AppHandle, AppSettings, RunOptions } from "./app.js";
export { app } from "./app.js";

// Command constructors as a namespace-style object.
import * as Command from "./command.js";

export { Command };

// Subscription constructors as a namespace-style object.
import * as Subscription from "./subscription.js";

// Event type guards.
export {
  isAsync,
  isCanvas,
  isClick,
  isEffect,
  isIme,
  isInput,
  isKey,
  isModifiers,
  isMouse,
  isMouseArea,
  isPane,
  isSelect,
  isSensor,
  isSlide,
  isStream,
  isSubmit,
  isSystem,
  isTimer,
  isToggle,
  isTouch,
  isWidget,
  isWindow,
  target,
} from "./events.js";
// Core types.
export type {
  AsyncEvent,
  CanvasEvent,
  Command as CommandType,
  DeepReadonly,
  EffectEvent,
  Event,
  Handler,
  ImeEvent,
  KeyEvent,
  Modifiers,
  ModifiersEvent,
  MouseAreaEvent,
  MouseEvent,
  PaneEvent,
  SensorEvent,
  StreamEvent,
  Subscription as SubscriptionType,
  SystemEvent,
  TimerEvent,
  TouchEvent,
  UINode,
  UpdateResult,
  WidgetEvent,
  WindowEvent,
} from "./types.js";
export { COMMAND } from "./types.js";
export { Subscription };

// Effects as a namespace-style object.
import * as Effects from "./effects.js";

export type { AdvanceResult, Animation, EasingFn } from "./animation.js";

// Animation functions.
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
  spring,
  startAnimation,
} from "./animation.js";
export { Effects };

// Selection state.
import * as Selection from "./selection.js";

export type { Selection as SelectionType } from "./selection.js";
export { Selection };

// Undo/redo stack.
import * as UndoStack from "./undo.js";

export type { UndoCommand, UndoEntry, UndoStack as UndoStackType } from "./undo.js";
export { UndoStack };

// Client-side routing.
import * as Route from "./route.js";

export type { Route as RouteType, RouteEntry } from "./route.js";
export { Route };

// Query pipeline.
import * as Data from "./data.js";

export type { QueryOptions, QueryResult, SortSpec } from "./data.js";
export { Data };

// Keyboard key constants.
import * as Keys from "./keys.js";

// Dev server.
export type { DevServerOptions } from "./dev-server.js";
export { DevServer } from "./dev-server.js";
export type {
  ExtensionBuildConfig,
  ExtensionPropType,
  ExtensionWidgetConfig,
} from "./extension.js";
// Extension widget system.
export {
  defineExtensionWidget,
  extensionCommands,
  generateCargoToml,
  generateMainRs,
  validateExtensions,
} from "./extension.js";
export type { Instruction, RunResult, Script, ScriptHeader } from "./script.js";
// Script parser/runner.
export { parseScript, parseScriptFile, runScript } from "./script.js";
export type { SEAConfig } from "./sea.js";
// Node.js SEA support.
export { extractBinaryFromSEA, generateSEAConfig, isSEA } from "./sea.js";
export type { WasmPaths } from "./wasm.js";
// WASM renderer support.
export { DEFAULT_WASM_DIR, resolveWasm, WASM_BG_FILE, WASM_JS_FILE } from "./wasm.js";
export { Keys };
