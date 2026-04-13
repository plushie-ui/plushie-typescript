# Builder internals

This document explains how plushie's widget builders and JSX runtime
work under the hood. You don't need this to use plushie, but it helps
when debugging unexpected behavior or writing custom abstractions.

## UINode structure

Every widget builder produces a `UINode`, a frozen, plain object:

```typescript
interface UINode {
  readonly id: string
  readonly type: string
  readonly props: Readonly<Record<string, unknown>>
  readonly children: readonly UINode[]
}
```

These are the only objects that travel through the tree layer. They
are serializable, diffable, and carry no behavior.

## Handler collection

Widget builders register event handlers into a module-level collector
during `view()`. After `view()` returns, the runtime drains the
collector and builds a handler map.

```
view() called
  -> Button({ onClick: increment }) called
    -> registerHandler("btn", "click", increment) into collector
    -> returns UINode { id: "btn", type: "button", props: { label: "+" } }
       (onClick is NOT in props)
  -> runtime drains collector -> Map { "btn" -> { "click" -> increment } }
```

This means handlers never touch the wire. The UINode sent to the
renderer has no handler props. The handler map is rebuilt from scratch
on every render cycle.

### Why this is safe

In DOM-based frameworks, inline closures cause performance problems
(VDOM prop diffs, broken memoization, listener churn). None of this
applies here:

- **Handlers aren't sent to the renderer.** They stay TypeScript-side.
- **Tree diffing doesn't compare handlers.** Only `id`, `type`,
  `props`, and `children` are diffed.
- **The handler map is rebuilt every render.** Handler identity
  doesn't matter; it's overwritten unconditionally.

## Prop encoding

Widget builders encode props at construction time. Each prop type
has an encoding function that converts the TypeScript representation
to the wire format:

```
TypeScript:  { padding: { top: 10, right: 20 } }
Wire:        { padding: [10, 20, 0, 0] }

TypeScript:  { color: 'red' }
Wire:        { color: '#ff0000' }

TypeScript:  { font: { family: 'Arial', weight: 'semi_bold' } }
Wire:        { font: { family: 'Arial', weight: 'SemiBold' } }
```

The `putIf` helper omits undefined props entirely; they don't
appear on the wire.

## Tree normalization

After `view()` returns a UINode tree, the runtime normalizes it:

1. **Scoped IDs**: named containers prefix their children's IDs
   with `parentId/`. Auto-ID and window nodes don't create scopes.
2. **A11y resolution**: `labelledBy`, `describedBy`, `errorMessage`
   references are resolved relative to the current scope.
3. **Validation**: IDs containing `/` are rejected. Duplicate
   sibling IDs produce warnings.
4. **Null/array handling**: `null` becomes an empty container.
   Arrays are wrapped in a synthetic root.

## Tree diffing

The differ compares old and new normalized trees:

1. ID/type mismatch -> replace entire subtree
2. Props diff key-by-key (null for removed props)
3. Children diff by ID:
   - Reorder detection (O(n) set comparison)
   - If reordered: replace parent
   - Otherwise: removals (descending), updates (adjusted indices),
     inserts (ascending)

Patches are sent to the renderer in safe application order.

## JSX runtime

The JSX runtime (`plushie/jsx-runtime`) maps JSX elements to widget
builder function calls:

```tsx
<Column padding={16} spacing={8}>
  <Text>Hello</Text>
</Column>
```

Becomes:

```typescript
jsx(Column, {
  padding: 16,
  spacing: 8,
  children: [jsx(Text, { children: 'Hello' })],
})
```

The `jsx` function calls the component function with props. Children
are normalized (nulls filtered, arrays flattened, booleans removed).

String children on leaf widgets become the content prop (e.g.,
`<Text>Hello</Text>` -> `Text({ children: 'Hello' })` -> the Text
builder reads `children` as the content string).

## Two API styles

Every widget has both a PascalCase JSX component and a camelCase
function API:

```typescript
// JSX:
<Button id="save" onClick={handler}>Save</Button>

// Function API:
button('save', 'Save', { onClick: handler })
```

Both produce the same UINode and register the same handlers.
The function API uses overloads for ergonomic call patterns
(auto-ID sugar, positional content args).
