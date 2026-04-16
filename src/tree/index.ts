export {
  diff,
  type InsertChild,
  type PatchOp,
  type RemoveChild,
  type ReplaceNode,
  type UpdateProps,
} from "./diff.js";
export { autoId, createNode, resetAutoId } from "./node.js";
export {
  isAutoId,
  type MemoCache,
  type MemoCacheEntry,
  type NormalizeContext,
  normalize,
  type WidgetViewCache,
  type WidgetViewCacheEntry,
  type WireNode,
} from "./normalize.js";
export { detectWindows, findById, findNode } from "./search.js";
