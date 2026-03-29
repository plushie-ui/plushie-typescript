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
 * Detect all window node IDs in the tree (recursive).
 *
 * Searches the entire tree for window nodes, matching the renderer's
 * behavior. Nested window nodes inside containers or layout widgets
 * are detected and tracked.
 *
 * @param tree - Normalized wire tree.
 * @returns Set of window node IDs found.
 */
export function detectWindows(tree: WireNode): Set<string> {
  const windows = new Set<string>();
  collectWindows(tree, windows);
  return windows;
}

function collectWindows(node: WireNode, acc: Set<string>): void {
  if (node.type === "window") {
    acc.add(node.id);
  }
  for (const child of node.children) {
    collectWindows(child, acc);
  }
}
