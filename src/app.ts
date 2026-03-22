import type {
  Command,
  DeepReadonly,
  Event,
  Handler,
  Subscription,
  UINode,
  UpdateResult,
  WidgetEvent,
} from "./types.js"

/**
 * Application settings passed to the renderer on startup.
 */
export interface AppSettings {
  readonly defaultTextSize?: number
  readonly defaultFont?: string | { family: string; weight?: string; style?: string }
  readonly antialiasing?: boolean
  readonly vsync?: boolean
  readonly scaleFactor?: number
  readonly theme?: string | Record<string, unknown>
  readonly fonts?: readonly string[]
  readonly defaultEventRate?: number
}

/**
 * Configuration object for creating a plushie app.
 *
 * The model type M is inferred from the return type of `init`.
 * Widget events are dispatched to inline `onXxx` handlers first;
 * unhandled events and non-widget events fall through to `update`.
 */
export interface AppConfig<M> {
  /** Initial state, optionally with startup commands. */
  init: M | readonly [M, Command | Command[]]

  /** Declarative view tree. Called after every state change. */
  view: (state: DeepReadonly<M>) => UINode | readonly UINode[]

  /**
   * Fallback event handler for events without inline handlers
   * (subscription events, async results, unhandled widget events).
   */
  update?: (
    state: DeepReadonly<M>,
    event: Event,
  ) => UpdateResult<M>

  /** Active subscriptions, re-evaluated after every state change. */
  subscriptions?: (state: DeepReadonly<M>) => (Subscription | false | null | undefined)[]

  /** Renderer settings (sent once on startup). */
  settings?: AppSettings

  /** Called when the renderer process exits unexpectedly. */
  handleRendererExit?: (state: DeepReadonly<M>, reason: string) => M
}

/**
 * An instantiated app definition, ready to be started.
 */
export interface AppDefinition<M> {
  readonly config: AppConfig<M>
}

/**
 * Extract the model type from an init value that may be a bare
 * state or a [state, command] tuple.
 */
type ExtractModel<T> = T extends readonly [infer M, ...unknown[]] ? M : T

/**
 * Create a plushie app definition.
 *
 * When the model type can be inferred from `init`, no explicit
 * generic is needed:
 *
 *     const counter = app({
 *       init: { count: 0 },
 *       view: (state) => ...  // state is Readonly<{ count: number }>
 *     })
 *
 * For complex models, provide the type explicitly:
 *
 *     const todo = app<TodoModel>({
 *       init: { todos: [], input: '', nextId: 1 },
 *       view: (state) => ...
 *     })
 */
export function app<M>(config: AppConfig<M>): AppDefinition<M>
export function app(
  config: AppConfig<unknown> & { init: unknown },
): AppDefinition<unknown> {
  return { config }
}
