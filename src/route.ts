/**
 * Client-side navigation routing with a stack-based history.
 *
 * Routes are immutable. Push and pop return new Route values.
 * The stack always has at least one entry (the root).
 *
 * @module
 */

// -- Types ----------------------------------------------------------------

/** A single entry in the navigation stack. */
export interface RouteEntry {
  readonly path: string
  readonly params: Readonly<Record<string, unknown>>
}

/** Immutable navigation state with a stack of route entries. */
export interface Route {
  readonly stack: readonly RouteEntry[]
}

// -- Creation -------------------------------------------------------------

/** Create a new route with an initial path at the bottom of the stack. */
export function createRoute(
  path: string,
  params: Record<string, unknown> = {},
): Route {
  return { stack: [{ path, params }] }
}

// -- Operations -----------------------------------------------------------

/** Push a new path onto the navigation stack. */
export function push(
  route: Route,
  path: string,
  params: Record<string, unknown> = {},
): Route {
  return { stack: [{ path, params }, ...route.stack] }
}

/** Pop the top entry. Never pops the last (root) entry. */
export function pop(route: Route): Route {
  if (route.stack.length <= 1) return route
  return { stack: route.stack.slice(1) }
}

/** Replace the top entry on the stack with a new path and params (without pushing). */
export function replaceTop(
  route: Route,
  path: string,
  params: Record<string, unknown> = {},
): Route {
  const [, ...rest] = route.stack
  return { stack: [{ path, params }, ...rest] }
}

/** Return the current (top) path. */
export function currentPath(route: Route): string {
  return route.stack[0]!.path
}

/** Return the params associated with the current (top) path. */
export function currentParams(route: Route): Readonly<Record<string, unknown>> {
  return route.stack[0]!.params
}

/** Return true if there is more than one entry on the stack. */
export function canGoBack(route: Route): boolean {
  return route.stack.length > 1
}

/** Return all paths in the stack, most recent first. */
export function routeHistory(route: Route): string[] {
  return route.stack.map(e => e.path)
}
