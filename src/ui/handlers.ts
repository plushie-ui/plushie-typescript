/**
 * Handler helpers for widget events.
 *
 * Widget builders attach handlers to node metadata. The runtime reads
 * that metadata while walking the tree to build the handler dispatch map.
 *
 * The module-level collector remains as a direct low-level API for tests
 * and legacy callers. Widget builders do not write to it.
 *
 * Handlers are NOT included in UINode props; they never touch the
 * wire. They're stored TypeScript-side only.
 *
 * @module
 */

import type { Handler } from "../types.js";

export const HANDLERS_META_KEY = "__handlers__";
export type HandlerMeta = Readonly<Record<string, Handler<unknown>>>;

/** A registered handler entry. */
export interface HandlerEntry {
  /** The widget ID (will be scoped during normalization). */
  readonly widgetId: string;
  /** The event type this handler responds to (e.g., "click", "input"). */
  readonly eventType: string;
  /** The handler function. */
  readonly handler: Handler<unknown>;
}

export function withHandlersMeta(
  meta: Readonly<Record<string, unknown>> | undefined,
  handlers: HandlerMeta | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (handlers === undefined || Object.keys(handlers).length === 0) return meta;
  return Object.freeze({ ...(meta ?? {}), [HANDLERS_META_KEY]: handlers });
}

export function handlersMeta(
  meta: Readonly<Record<string, unknown>> | undefined,
): HandlerMeta | undefined {
  const value = meta?.[HANDLERS_META_KEY];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as HandlerMeta;
  }
  return undefined;
}

/** Module-level handler collector for the direct low-level API. */
let handlerEntries: HandlerEntry[] = [];

/**
 * Register a handler for a widget event.
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
