export { createNode, autoId, resetAutoId } from "./node.js"
export { normalize, isAutoId, type WireNode } from "./normalize.js"
export { diff, type PatchOp, type ReplaceNode, type UpdateProps, type InsertChild, type RemoveChild } from "./diff.js"
export { findNode, findById, detectWindows } from "./search.js"
