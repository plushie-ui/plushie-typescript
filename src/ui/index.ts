// Re-export tree node utilities for widget builders.
export { createNode, autoId, resetAutoId } from "../tree/index.js"

// Widget builder functions and JSX components will be added here.
// Each widget module exports both PascalCase (JSX) and camelCase
// (function API) variants. Both return UINode.
//
// Shared prop types (Length, Padding, Color, Font, Border, Shadow,
// StyleMap, A11y) will live in ui/types.ts.
