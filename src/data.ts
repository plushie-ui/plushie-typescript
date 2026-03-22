// -- Types ----------------------------------------------------------------

export interface QueryOptions<T> {
  readonly filter?: (record: T) => boolean
  readonly search?: { fields: string[]; query: string }
  readonly sort?: SortSpec | SortSpec[]
  readonly group?: string
  readonly page?: number
  readonly pageSize?: number
}

export type SortSpec = { direction: "asc" | "desc"; field: string }

export interface QueryResult<T> {
  readonly entries: T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly groups: Record<string, T[]> | null
}

// -- Query pipeline -------------------------------------------------------

/** Query a list of records with optional filter, search, sort, and pagination. */
export function query<T extends Record<string, unknown>>(
  records: readonly T[],
  opts: QueryOptions<T> = {},
): QueryResult<T> {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 25

  let result: T[] = [...records]

  // Filter
  if (opts.filter) {
    result = result.filter(opts.filter)
  }

  // Search
  if (opts.search) {
    const q = opts.search.query.toLowerCase()
    const fields = opts.search.fields
    result = result.filter(record =>
      fields.some(field => {
        const val = record[field]
        return String(val ?? "").toLowerCase().includes(q)
      }),
    )
  }

  // Sort
  if (opts.sort) {
    const specs = Array.isArray(opts.sort) ? opts.sort : [opts.sort]
    result.sort((a, b) => compareRecords(a, b, specs))
  }

  // Paginate
  const total = result.length
  const offset = (page - 1) * pageSize
  const entries = result.slice(offset, offset + pageSize)

  // Group
  let groups: Record<string, T[]> | null = null
  if (opts.group) {
    const groupField = opts.group
    groups = {}
    for (const entry of entries) {
      const key = String(entry[groupField] ?? "")
      if (!(key in groups)) {
        groups[key] = []
      }
      groups[key]!.push(entry)
    }
  }

  return { entries, total, page, pageSize, groups }
}

// -- Sorting helpers ------------------------------------------------------

function compareRecords(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  specs: SortSpec[],
): number {
  for (const spec of specs) {
    const va = a[spec.field]
    const vb = b[spec.field]

    if (va === vb) continue

    const cmp = compareValues(va, vb)
    if (cmp !== 0) {
      return spec.direction === "desc" ? -cmp : cmp
    }
  }
  return 0
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b
  }
  const sa = String(a ?? "")
  const sb = String(b ?? "")
  if (sa < sb) return -1
  if (sa > sb) return 1
  return 0
}
