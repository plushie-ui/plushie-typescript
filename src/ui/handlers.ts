/**
 * Handler collection mechanism for the view -> runtime bridge.
 *
 * During a view() call, widget builders register event handlers into
 * a module-level collector. After view() returns, the runtime reads
 * and clears the collector to build the handler dispatch map.
 *
 * Handlers are NOT included in UINode props -- they never touch the
 * wire. They're stored TypeScript-side only.
 *
 * @module
 */

import type { Handler } from "../types.js";

/** A registered handler entry. */
export interface HandlerEntry {
  /** The widget ID (will be scoped during normalization). */
  readonly widgetId: string;
  /** The event type this handler responds to (e.g., "click", "input"). */
  readonly eventType: string;
  /** The handler function. */
  readonly handler: Handler<unknown>;
}

/** Module-level handler collector. Reset between view() calls. */
let handlerEntries: HandlerEntry[] = [];

/**
 * Register a handler for a widget event.
 * Called by widget builders during view() construction.
 *
 * @internal
 */
export function registerHandler(
  widgetId: string,
  eventType: string,
  handler: Handler<unknown>,
): void {
  handlerEntries.push({ widgetId, eventType, handler });
}

/**
 * Drain all collected handlers and reset the collector.
 * Called by the runtime after view() returns.
 *
 * @returns All handler entries collected during the last view() call.
 * @internal
 */
export function drainHandlers(): HandlerEntry[] {
  const entries = handlerEntries;
  handlerEntries = [];
  return entries;
}

/**
 * Clear the handler collector without reading.
 * Used for cleanup on errors.
 *
 * @internal
 */
export function clearHandlers(): void {
  handlerEntries = [];
}
