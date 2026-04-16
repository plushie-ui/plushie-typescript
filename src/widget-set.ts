/**
 * Widget set: override specific widget builders with alternatives.
 *
 * A widget set merges all default `plushie/ui` builders with custom
 * replacements, enabling widget packs, custom themes, and per-app
 * widget customization without manual import juggling.
 *
 * @module
 */

import type { UINode } from "./types.js";
import * as DefaultUI from "./ui/index.js";

export type WidgetBuilder = (id: string, ...args: readonly unknown[]) => UINode;

type WidgetBuilders = Record<string, WidgetBuilder>;

export type WidgetOverrides = Record<string, WidgetBuilder>;

export type WidgetSet<T extends WidgetOverrides = WidgetOverrides> = Omit<
  typeof DefaultUI,
  keyof T
> &
  T;

export function createWidgetSet<T extends WidgetOverrides>(overrides: T): WidgetSet<T> {
  return { ...(DefaultUI as unknown as WidgetBuilders), ...overrides } as WidgetSet<T>;
}
