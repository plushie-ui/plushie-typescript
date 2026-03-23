/**
 * Tree search utilities.
 *
 * @module
 */

import type { WireNode } from "./normalize.js";

/**
 * Find the first node in the tree matching a predicate (depth-first).
 *
 * @param tree - Root of the tree to search.
 * @param predicate - Function that returns true for a matching node.
 * @returns The first matching node, or null if not found.
 */
export function findNode(tree: WireNode, predicate: (node: WireNode) => boolean): WireNode | null {
  if (predicate(tree)) return tree;
  for (const child of tree.children) {
    const found = findNode(child, predicate);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Find a node by its ID (depth-first search).
 *
 * @param tree - Root of the tree to search.
 * @param id - The node ID to find.
 * @returns The matching node, or null if not found.
 */
export function findById(tree: WireNode, id: string): WireNode | null {
  return findNode(tree, (node) => node.id === id);
}

/**
 * Detect window node IDs at the root or direct-child level.
 *
 * Window nodes are only recognized at the top of the tree -- they
 * must be the root node itself or direct children of the root.
 *
 * @param tree - Normalized wire tree.
 * @returns Set of window node IDs found.
 */
export function detectWindows(tree: WireNode): Set<string> {
  const windows = new Set<string>();

  if (tree.type === "window") {
    windows.add(tree.id);
  }

  for (const child of tree.children) {
    if (child.type === "window") {
      windows.add(child.id);
    }
  }

  return windows;
}
