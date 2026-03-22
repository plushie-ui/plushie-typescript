export { createNode, autoId, resetAutoId } from "./node.js"

// Widget builder functions will be added here as the framework grows.
// Each widget module (button.ts, text.ts, column.ts, etc.) will export
// both a PascalCase JSX component and a camelCase function API.
//
// For now, re-export the node creation utility so the JSX runtime
// and tests can use it.
