/**
 * plushie: Native desktop GUI framework for TypeScript.
 *
 * This is the main entry point. It provides:
 *
 * - {@link app}: create an application definition (init/view/update)
 * - {@link Command}: pure-data side effects (async, focus, scroll, exit, etc.)
 * - {@link Subscription}: declarative event sources (timers, key/mouse events)
 * - Event type guards: `isClick`, `isTimer`, `isAsync`, etc. for narrowing events
 * - Core types: `UINode`, `Event`, `Handler`, `DeepReadonly`, etc.
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

export type {
  AppConfig,
  AppDefinition,
  AppHandle,
  AppSettings,
  AppView,
  RunOptions,
  WindowNode,
} from "./app.js";
export { app } from "./app.js";

export type { EventSpec, FieldType } from "./event-spec.js";
export { builtinSpec, validateEmitData, validateFieldType } from "./event-spec.js";
export { memo } from "./memo.js";
// Widget handler system (stateful pure-TypeScript widgets).
export type {
  EventAction,
  Registry,
  RegistryEntry,
  WidgetDef,
  WidgetOpts,
} from "./widget-handler.js";
export { buildWidget } from "./widget-handler.js";

export type { WidgetBuilder, WidgetOverrides, WidgetSet } from "./widget-set.js";
export { createWidgetSet } from "./widget-set.js";

// Command constructors as a namespace-style object.
import * as Command from "./command.js";

export { Command };

// Subscription constructors as a namespace-style object.
import * as Subscription from "./subscription.js";

// Event type guards.
export {
  isAsync,
  isBlurred,
  isClick,
  isDrag,
  isEffect,
  isFocused,
  isIme,
  isInput,
  isKey,
  isModifiers,
  isMove,
  isPane,
  isPointer,
  isPress,
  isRelease,
  isResize,
  isScroll,
  isScrolled,
  isSelect,
  isSlide,
  isStream,
  isSubmit,
  isSystem,
  isTimer,
  isToggle,
  isWidget,
  isWidgetCommandError,
  isWidgetKeyPress,
  isWindow,
  target,
} from "./events.js";
// Core types.
export type {
  AsyncEvent,
  Command as CommandType,
  DeepReadonly,
  DragData,
  EffectEvent,
  Event,
  Handler,
  ImeEvent,
  KeyEvent,
  KeyPressData,
  KeyReleaseData,
  Modifiers,
  ModifiersEvent,
  PointerButton,
  PointerData,
  PointerType,
  RendererExit,
  RendererExitType,
  ResizeData,
  ScrolledData,
  StreamEvent,
  Subscription as SubscriptionType,
  SystemEvent,
  TimerEvent,
  UINode,
  UpdateResult,
  WidgetCommandErrorEvent,
  WidgetEvent,
  WindowEvent,
} from "./types.js";
export { COMMAND } from "./types.js";
export { Subscription };

// Effect as a namespace-style object (singular, matches Command).
import * as Effect from "./effect.js";

export type {
  CubicBezier,
  Easing,
  EasingName,
  SequenceDescriptor,
  SequenceOpts,
  SequenceStep,
  SpringDescriptor,
  SpringOpts,
  SpringPreset,
  TransitionDescriptor,
  TransitionOpts,
} from "./animation/index.js";
// Renderer-side animation descriptors.
export { cubicBezier, loop, sequence, spring, transition } from "./animation/index.js";
export { ANIMATION_DESCRIPTOR } from "./animation/transition.js";
// SDK-side tween animation types.
export type { AdvanceResult, Animation, EasingFn } from "./animation/tween.js";
// SDK-side tween animation functions.
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
  looping,
  springEase,
  startAnimation,
} from "./animation/tween.js";
export { withAnimation } from "./ui/build.js";
export { Effect };

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
export type { Diagnostic, TransportFactory } from "./runtime.js";
export { Runtime } from "./runtime.js";
export { Data };

// Keyboard key constants.
import * as Keys from "./keys.js";

// Dev server.
export type { DevServerOptions } from "./dev-server.js";
export { DevServer } from "./dev-server.js";
export { resolveKey } from "./keys.js";
export type {
  NativeWidgetConfig,
  NativeWidgetPropType,
} from "./native-widget.js";
// Native widget system (Rust-backed widgets).
export { defineNativeWidget, nativeWidgetCommands } from "./native-widget.js";
// Native widget build-time types (values are in native-widget-build.ts,
// imported only by the CLI to avoid pulling node:path into browser builds).
export type { NativeWidgetBuildConfig } from "./native-widget-build.js";
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
