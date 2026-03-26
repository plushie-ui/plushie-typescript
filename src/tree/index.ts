export {
  diff,
  type InsertChild,
  type PatchOp,
  type RemoveChild,
  type ReplaceNode,
  type UpdateProps,
} from "./diff.js";
export { autoId, createNode, resetAutoId } from "./node.js";
export { isAutoId, type NormalizeContext, normalize, type WireNode } from "./normalize.js";
export { detectWindows, findById, findNode } from "./search.js";
