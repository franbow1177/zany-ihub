import { describe, expect, test } from "bun:test"
import { assertParentIsFolder, RESOURCE_KINDS } from "./resource-rules"

describe("resource rules", () => {
  test("exposes every resource kind", () => {
    expect(RESOURCE_KINDS).toEqual([
      "folder",
      "file",
      "doc",
      "table",
      "whiteboard",
      "project",
      "bookmark",
    ])
  })

  test("allows null parent", () => {
    expect(() => assertParentIsFolder(null)).not.toThrow()
  })

  test("rejects non-folder parent", () => {
    expect(() => assertParentIsFolder({ kind: "doc" })).toThrow()
  })

  test("allows folder parent", () => {
    expect(() => assertParentIsFolder({ kind: "folder" })).not.toThrow()
  })
})
