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
