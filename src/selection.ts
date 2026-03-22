// -- Types ----------------------------------------------------------------

export type SelectionMode = "single" | "multi" | "range"

export interface Selection {
  readonly mode: SelectionMode
  readonly selected: ReadonlySet<string>
  readonly anchor: string | null
  readonly order: readonly string[]
}

export interface SelectOptions {
  readonly extend?: boolean
}

// -- Creation -------------------------------------------------------------

/** Create a new selection state. */
export function createSelection(opts: {
  mode?: SelectionMode
  order?: string[]
} = {}): Selection {
  return {
    mode: opts.mode ?? "single",
    selected: new Set(),
    anchor: null,
    order: opts.order ?? [],
  }
}

// -- Operations -----------------------------------------------------------

/** Select an item. In single mode, replaces. In multi/range, replaces unless extend is true. */
export function select(sel: Selection, id: string, opts: SelectOptions = {}): Selection {
  if (sel.mode === "single") {
    return { ...sel, selected: new Set([id]), anchor: id }
  }

  if (opts.extend) {
    const next = new Set(sel.selected)
    next.add(id)
    return { ...sel, selected: next, anchor: id }
  }

  return { ...sel, selected: new Set([id]), anchor: id }
}

/** Toggle an item in the selection. */
export function toggle(sel: Selection, id: string): Selection {
  if (sel.mode === "single") {
    if (sel.selected.has(id)) {
      return { ...sel, selected: new Set(), anchor: null }
    }
    return { ...sel, selected: new Set([id]), anchor: id }
  }

  if (sel.selected.has(id)) {
    const next = new Set(sel.selected)
    next.delete(id)
    return { ...sel, selected: next }
  }

  const next = new Set(sel.selected)
  next.add(id)
  return { ...sel, selected: next, anchor: id }
}

/** Remove an item from the selection. */
export function deselect(sel: Selection, id: string): Selection {
  const next = new Set(sel.selected)
  next.delete(id)
  return { ...sel, selected: next }
}

/** Clear all selected items and reset the anchor. */
export function clear(sel: Selection): Selection {
  return { ...sel, selected: new Set(), anchor: null }
}

/** Select a range from anchor to id using the order list. */
export function rangeSelect(sel: Selection, id: string): Selection {
  if (sel.anchor === null) {
    return { ...sel, selected: new Set([id]), anchor: id }
  }

  const anchorIdx = sel.order.indexOf(sel.anchor)
  const idIdx = sel.order.indexOf(id)

  if (anchorIdx === -1 || idIdx === -1) {
    return { ...sel, selected: new Set([id]), anchor: id }
  }

  const lo = Math.min(anchorIdx, idIdx)
  const hi = Math.max(anchorIdx, idIdx)
  const rangeIds = sel.order.slice(lo, hi + 1)
  return { ...sel, selected: new Set(rangeIds) }
}

/** Return the set of currently selected item IDs. */
export function selected(sel: Selection): ReadonlySet<string> {
  return sel.selected
}

/** Return true if an item is currently selected. */
export function isSelected(sel: Selection, id: string): boolean {
  return sel.selected.has(id)
}
