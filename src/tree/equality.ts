const MAX_EQUALITY_DEPTH = 8;

/**
 * Compare tree values without trusting arbitrary object instances.
 */
export function treeValueEqual(a: unknown, b: unknown): boolean {
  return treeValueEqualAtDepth(a, b, MAX_EQUALITY_DEPTH);
}

function treeValueEqualAtDepth(a: unknown, b: unknown, depth: number): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  if (depth <= 0) return false;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && Object.is(a.getTime(), b.getTime());
  }

  if (a instanceof RegExp || b instanceof RegExp) {
    return (
      a instanceof RegExp && b instanceof RegExp && a.source === b.source && a.flags === b.flags
    );
  }

  if (a instanceof Map || b instanceof Map) {
    return mapsEqual(a, b, depth - 1);
  }

  if (a instanceof Set || b instanceof Set) {
    return setsEqual(a, b, depth - 1);
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return arraysEqual(a, b, depth - 1);
  }

  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  return plainObjectsEqual(a, b, depth - 1);
}

function arraysEqual(a: unknown, b: unknown, depth: number): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!treeValueEqualAtDepth(a[i], b[i], depth)) return false;
  }
  return true;
}

function mapsEqual(a: unknown, b: unknown, depth: number): boolean {
  if (!(a instanceof Map) || !(b instanceof Map)) return false;
  if (a.size !== b.size) return false;

  const remaining = [...b];
  outer: for (const [key, value] of a) {
    for (let i = 0; i < remaining.length; i++) {
      const [otherKey, otherValue] = remaining[i]!;
      if (
        treeValueEqualAtDepth(key, otherKey, depth) &&
        treeValueEqualAtDepth(value, otherValue, depth)
      ) {
        remaining.splice(i, 1);
        continue outer;
      }
    }
    return false;
  }
  return true;
}

function setsEqual(a: unknown, b: unknown, depth: number): boolean {
  if (!(a instanceof Set) || !(b instanceof Set)) return false;
  if (a.size !== b.size) return false;

  const remaining = [...b];
  outer: for (const value of a) {
    for (let i = 0; i < remaining.length; i++) {
      if (treeValueEqualAtDepth(value, remaining[i], depth)) {
        remaining.splice(i, 1);
        continue outer;
      }
    }
    return false;
  }
  return true;
}

function plainObjectsEqual(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
  depth: number,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key)) return false;
    if (!treeValueEqualAtDepth(a[key], b[key], depth)) return false;
  }
  return true;
}

function isPlainObject(value: object): value is Readonly<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
