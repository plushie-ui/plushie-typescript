/**
 * Tree diffing and patch generation.
 *
 * Compares an old and new wire tree and produces minimal patch
 * operations for incremental updates. The renderer applies patches
 * sequentially in the order they appear.
 *
 * ## Patch ordering
 *
 * Operations are emitted in safe application order:
 * 1. Removals (descending child index): clears the way
 * 2. Updates (with indices adjusted for prior removals)
 * 3. Inserts (ascending child index)
 *
 * ## Reorder detection
 *
 * Uses O(n) set comparison, not LCS. If common children appear in
 * different order between old and new, the entire parent subtree is
 * replaced. This trades move precision for simplicity and speed.
 *
 * @module
 */

import { treeValueEqual } from "./equality.js";
import type { WireNode } from "./normalize.js";

// =========================================================================
// Patch operation types
// =========================================================================

/** Replace an entire subtree at the given path. */
export interface ReplaceNode {
  readonly op: "replace_node";
  readonly path: readonly number[];
  readonly node: WireNode;
}

/** Merge props into the node at the given path. Null values remove keys. */
export interface UpdateProps {
  readonly op: "update_props";
  readonly path: readonly number[];
  readonly props: Readonly<Record<string, unknown>>;
}

/** Insert a child at the given index under the parent at path. */
export interface InsertChild {
  readonly op: "insert_child";
  readonly path: readonly number[];
  readonly index: number;
  readonly node: WireNode;
}

/** Remove the child at the given index under the parent at path. */
export interface RemoveChild {
  readonly op: "remove_child";
  readonly path: readonly number[];
  readonly index: number;
}

/** Union of all patch operation types. */
export type PatchOp = ReplaceNode | UpdateProps | InsertChild | RemoveChild;

// =========================================================================
// Diffing
// =========================================================================

/**
 * Diff two wire trees and produce patch operations.
 *
 * @param oldTree - Previous tree (null on first render or after restart).
 * @param newTree - Current tree from view().
 * @returns Array of patch operations (empty if trees are identical).
 *
 * @example
 * ```ts
 * // First render: replace entire root
 * diff(null, newTree)
 * // => [{ op: "replace_node", path: [], node: newTree }]
 *
 * // Prop change only
 * diff(oldTree, newTree)
 * // => [{ op: "update_props", path: [0], props: { label: "new" } }]
 * ```
 */
export function diff(oldTree: WireNode | null, newTree: WireNode): PatchOp[] {
  if (oldTree === null) {
    return [{ op: "replace_node", path: [], node: newTree }];
  }
  return diffNode(oldTree, newTree, []);
}

/**
 * Recursively diff two nodes at the given path.
 */
function diffNode(oldNode: WireNode, newNode: WireNode, path: readonly number[]): PatchOp[] {
  // Reference equality: identical objects (from memo/cache hit) need no diffing
  if (oldNode === newNode) {
    return [];
  }

  // ID mismatch: completely different node
  if (oldNode.id !== newNode.id) {
    return [{ op: "replace_node", path, node: newNode }];
  }

  // Type mismatch: different widget type
  if (oldNode.type !== newNode.type) {
    return [{ op: "replace_node", path, node: newNode }];
  }

  // Check for reorder in children
  const childResult = diffChildren(oldNode.children, newNode.children, path);
  if (childResult === "reordered") {
    return [{ op: "replace_node", path, node: newNode }];
  }

  // Diff props
  const propOps = diffProps(oldNode.props, newNode.props, path);

  return [...propOps, ...childResult];
}

/**
 * Diff props between two nodes. Changed values produce an update_props
 * operation. Removed keys are set to null.
 */
function diffProps(
  oldProps: Readonly<Record<string, unknown>>,
  newProps: Readonly<Record<string, unknown>>,
  path: readonly number[],
): PatchOp[] {
  const changes: Record<string, unknown> = {};
  let hasChanges = false;

  // Check for changed and new props
  for (const key of Object.keys(newProps)) {
    if (!treeValueEqual(oldProps[key], newProps[key])) {
      changes[key] = newProps[key];
      hasChanges = true;
    }
  }

  // Check for removed props (set to null on the wire)
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      changes[key] = null;
      hasChanges = true;
    }
  }

  if (!hasChanges) return [];
  return [{ op: "update_props", path, props: changes }];
}

/**
 * Diff children between two nodes. Returns patch operations or
 * "reordered" if common children appear in a different order.
 */
function diffChildren(
  oldChildren: readonly WireNode[],
  newChildren: readonly WireNode[],
  path: readonly number[],
): PatchOp[] | "reordered" {
  // Build ID -> {node, index} maps
  const oldById = new Map<string, { node: WireNode; index: number }>();
  for (let i = 0; i < oldChildren.length; i++) {
    oldById.set(oldChildren[i]!.id, { node: oldChildren[i]!, index: i });
  }

  const newById = new Map<string, { node: WireNode; index: number }>();
  for (let i = 0; i < newChildren.length; i++) {
    newById.set(newChildren[i]!.id, { node: newChildren[i]!, index: i });
  }

  // Extract common IDs in their original order
  const commonOld = oldChildren.filter((c) => newById.has(c.id)).map((c) => c.id);
  const commonNew = newChildren.filter((c) => oldById.has(c.id)).map((c) => c.id);

  // Reorder detection: if common children appear in different order,
  // force a full replace of this subtree
  if (commonOld.length !== commonNew.length) {
    return "reordered"; // shouldn't happen, but guard
  }
  for (let i = 0; i < commonOld.length; i++) {
    if (commonOld[i] !== commonNew[i]) {
      return "reordered";
    }
  }

  const ops: PatchOp[] = [];

  // 1. Removals (descending index to avoid shifting)
  const removedIndices: number[] = [];
  for (let i = oldChildren.length - 1; i >= 0; i--) {
    if (!newById.has(oldChildren[i]!.id)) {
      ops.push({ op: "remove_child", path, index: i });
      removedIndices.push(i);
    }
  }

  // 2. Updates (with adjusted indices accounting for removals)
  for (const newChild of newChildren) {
    const oldEntry = oldById.get(newChild.id);
    if (oldEntry !== undefined) {
      const adjustedIndex = indexAfterRemovals(oldEntry.index, removedIndices);
      const childPath = [...path, adjustedIndex];
      const childOps = diffNode(oldEntry.node, newChild, childPath);
      ops.push(...childOps);
    }
  }

  // 3. Inserts (ascending index)
  for (let i = 0; i < newChildren.length; i++) {
    if (!oldById.has(newChildren[i]!.id)) {
      ops.push({ op: "insert_child", path, index: i, node: newChildren[i]! });
    }
  }

  return ops;
}

/**
 * Calculate what index an old child would have after removals.
 *
 * @param oldIdx - The child's original index.
 * @param removedIndices - Indices that were removed (any order).
 * @returns The adjusted index.
 */
function indexAfterRemovals(oldIdx: number, removedIndices: number[]): number {
  let count = 0;
  for (const removed of removedIndices) {
    if (removed < oldIdx) count++;
  }
  return oldIdx - count;
}
