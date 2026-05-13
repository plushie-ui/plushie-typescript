/**
 * App definition and factory.
 *
 * The `app()` function creates a plushie application definition.
 * Call `.run()` on the result to start the app with a renderer.
 *
 * @module
 */

import process from "node:process";
import { resolveBinary } from "./client/binary.js";
import { SocketTransport } from "./client/socket_transport.js";
import type { WireFormat } from "./client/transport.js";
import { SpawnTransport, StdioTransport } from "./client/transport.js";
import type { NativeWidgetConfig } from "./native-widget.js";
import { Runtime } from "./runtime.js";
import type {
  Command,
  DeepReadonly,
  Event,
  RendererExit,
  Subscription,
  UINode,
  UpdateResult,
} from "./types.js";

export type WindowNode = UINode & { readonly type: "window" };
export type AppView = WindowNode | readonly WindowNode[] | null;

/**
 * Application settings passed to the renderer on startup.
 */
export interface AppSettings {
  readonly defaultTextSize?: number;
  readonly defaultFont?: { family: string; weight?: string; style?: string };
  readonly antialiasing?: boolean;
  readonly vsync?: boolean;
  readonly scaleFactor?: number;
  readonly theme?: string | Record<string, unknown>;
  readonly fonts?: readonly string[];
  readonly defaultEventRate?: number;
  /**
   * Configuration passed to native widgets at runtime.
   * Keyed by native widget type name.
   * Sent in the Settings message so native widgets can initialize their state.
   */
  readonly nativeWidgetConfig?: Readonly<Record<string, unknown>>;
  readonly validateProps?: boolean;
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
  init: M | readonly [M, Command | Command[]];

  /**
   * Declarative view tree. Called after every state change.
   *
   * The top level must be a window node or a list of window nodes.
   */
  view: (state: DeepReadonly<M>) => AppView;

  /**
   * Fallback event handler for events without inline handlers
   * (subscription events, async results, unhandled widget events).
   *
   * Required. Static-display apps can return the model unchanged
   * (`return [state];`).
   */
  update: (state: DeepReadonly<M>, event: Event) => UpdateResult<M>;

  /**
   * Active subscriptions, re-evaluated after every state change.
   *
   * The return value is a strict `Subscription[]`. Callers that need
   * conditional subscriptions should build the array explicitly
   * (`condition ? [sub()] : []`) rather than relying on a falsy
   * filter at this layer.
   */
  subscriptions?: (state: DeepReadonly<M>) => Subscription[];

  /** Renderer settings (sent once on startup). */
  settings?: AppSettings;

  /** Default window configuration, merged under per-window props. */
  windowConfig?: (state: DeepReadonly<M>) => Record<string, unknown>;

  /** Native extensions this app expects the renderer to have loaded. */
  requiredWidgets?: readonly (string | NativeWidgetConfig)[];

  /** Called when the renderer process exits unexpectedly. */
  handleRendererExit?: (state: DeepReadonly<M>, reason: RendererExit) => M;
}

/** Options for running an app. */
export interface RunOptions {
  /** Path to the plushie binary. Resolved automatically if omitted. */
  binary?: string;
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat;
  /** Additional CLI arguments for the renderer binary. */
  args?: string[];
  /** Override RUST_LOG for the renderer. */
  rustLog?: string;
  /** Transport mode: "spawn" (default), "stdio", or "socket". */
  transport?: "spawn" | "stdio" | "socket";
  /** Socket address for renderer-parent launch. Defaults to PLUSHIE_SOCKET. */
  socket?: string;
  /** Shared listen token. Defaults to PLUSHIE_TOKEN. */
  token?: string | null;
}

/** Handle for a running app. */
export interface AppHandle<M> {
  /** Stop the app and close the renderer. */
  stop(): void;
  /** Get the current model (readonly). */
  model(): DeepReadonly<M>;
}

/**
 * An instantiated app definition, ready to be started.
 */
export interface AppDefinition<M> {
  /** The app configuration. */
  readonly config: AppConfig<M>;
  /** Start the app with a renderer. */
  run(opts?: RunOptions): Promise<AppHandle<M>>;
}

/**
 * Create a plushie app definition.
 *
 * When the model type can be inferred from `init`, no explicit
 * generic is needed:
 *
 * ```ts
 * const counter = app({
 *   init: { count: 0 },
 *   view: (state) => ...  // state is Readonly<{ count: number }>
 * })
 * ```
 *
 * For complex models, provide the type explicitly:
 *
 * ```ts
 * const todo = app<TodoModel>({
 *   init: { todos: [], input: '', nextId: 1 },
 *   view: (state) => ...
 * })
 * ```
 */
export function app<M>(config: AppConfig<M>): AppDefinition<M> {
  return {
    config,
    async run(opts: RunOptions = {}): Promise<AppHandle<M>> {
      const transportMode =
        opts.transport ??
        (process.env["PLUSHIE_TRANSPORT"] === "socket" || process.env["PLUSHIE_SOCKET"]
          ? "socket"
          : process.env["PLUSHIE_TRANSPORT"] === "stdio"
            ? "stdio"
            : "spawn");
      const token = opts.token === undefined ? process.env["PLUSHIE_TOKEN"] : opts.token;
      const runtimeOpts: { token?: string | null } = {};
      if (token !== undefined) runtimeOpts.token = token;

      const runtime = new Runtime(
        config,
        () => {
          if (transportMode === "socket") {
            const address = opts.socket ?? process.env["PLUSHIE_SOCKET"];
            if (!address) {
              throw new Error("socket transport requires opts.socket or PLUSHIE_SOCKET");
            }
            const socketOpts: ConstructorParameters<typeof SocketTransport>[0] = { address };
            if (opts.format !== undefined) socketOpts.format = opts.format;
            return new SocketTransport(socketOpts);
          }

          if (transportMode === "stdio") {
            const stdioOpts: ConstructorParameters<typeof StdioTransport>[0] = {};
            if (opts.format !== undefined) stdioOpts.format = opts.format;
            return new StdioTransport(stdioOpts);
          }

          const binary = opts.binary ?? resolveBinary();
          const transportOpts: import("./client/transport.js").SpawnTransportOptions = { binary };
          if (opts.format !== undefined) transportOpts.format = opts.format;
          if (opts.args !== undefined) transportOpts.args = opts.args;
          if (opts.rustLog !== undefined) transportOpts.rustLog = opts.rustLog;
          return new SpawnTransport(transportOpts);
        },
        "",
        runtimeOpts,
      );
      await runtime.start();

      return {
        stop: () => runtime.stop(),
        model: () => runtime.model() as DeepReadonly<M>,
      };
    },
  };
}
