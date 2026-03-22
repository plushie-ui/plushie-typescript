import { describe, expect, test } from "vitest"
import { Data } from "../src/index.js"

const records = [
  { name: "Alice", age: 30, dept: "eng" },
  { name: "Bob", age: 25, dept: "eng" },
  { name: "Carol", age: 35, dept: "design" },
  { name: "Dave", age: 28, dept: "design" },
  { name: "Eve", age: 32, dept: "eng" },
]

describe("Data.query", () => {
  test("returns all records with defaults", () => {
    const result = Data.query(records)
    expect(result.entries).toHaveLength(5)
    expect(result.total).toBe(5)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(25)
    expect(result.groups).toBeNull()
  })

  test("filter narrows results", () => {
    const result = Data.query(records, {
      filter: (r) => r["age"] as number > 29,
    })
    expect(result.entries).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  test("search matches case-insensitively", () => {
    const result = Data.query(records, {
      search: { fields: ["name"], query: "al" },
    })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!["name"]).toBe("Alice")
  })

  test("sort ascending by field", () => {
    const result = Data.query(records, {
      sort: { direction: "asc", field: "age" },
    })
    expect(result.entries[0]!["name"]).toBe("Bob")
    expect(result.entries[result.entries.length - 1]!["name"]).toBe("Carol")
  })

  test("sort descending by field", () => {
    const result = Data.query(records, {
      sort: { direction: "desc", field: "age" },
    })
    expect(result.entries[0]!["name"]).toBe("Carol")
  })

  test("multi-field sort", () => {
    const result = Data.query(records, {
      sort: [
        { direction: "asc", field: "dept" },
        { direction: "asc", field: "name" },
      ],
    })
    expect(result.entries[0]!["name"]).toBe("Carol")
    expect(result.entries[1]!["name"]).toBe("Dave")
    expect(result.entries[2]!["name"]).toBe("Alice")
  })

  test("pagination slices results", () => {
    const result = Data.query(records, {
      sort: { direction: "asc", field: "name" },
      page: 2,
      pageSize: 2,
    })
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]!["name"]).toBe("Carol")
    expect(result.entries[1]!["name"]).toBe("Dave")
    expect(result.total).toBe(5)
  })

  test("grouping organizes paginated entries", () => {
    const result = Data.query(records, {
      group: "dept",
    })
    expect(result.groups).not.toBeNull()
    expect(result.groups!["eng"]).toHaveLength(3)
    expect(result.groups!["design"]).toHaveLength(2)
  })

  test("pipeline order: filter -> search -> sort -> paginate", () => {
    const result = Data.query(records, {
      filter: (r) => r["dept"] === "eng",
      search: { fields: ["name"], query: "e" },
      sort: { direction: "asc", field: "name" },
      page: 1,
      pageSize: 10,
    })
    // Filter: Alice, Bob, Eve (eng). Search "e": Alice, Eve. Sort: Alice, Eve.
    expect(result.entries.map(e => e["name"])).toEqual(["Alice", "Eve"])
    expect(result.total).toBe(2)
  })

  test("empty records returns empty result", () => {
    const result = Data.query([])
    expect(result.entries).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
