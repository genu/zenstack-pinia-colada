import { describe, expect, it } from "vitest"
import { getQueryKey, parseQueryKey, isZenStackQueryKey } from "../src/common/query-key"

describe("Query Key Generation", () => {
  it("generates keys with correct structure and defaults", () => {
    const key = getQueryKey("User", "findMany", { take: 10 })
    expect(key).toEqual(["zenstack", "User", "findMany", { take: 10 }, { infinite: false, optimisticUpdate: true }])
  })

  it("forces optimisticUpdate to false for infinite queries", () => {
    const key = getQueryKey("User", "findMany", {}, { infinite: true, optimisticUpdate: true })
    expect(key[4]).toEqual({ infinite: true, optimisticUpdate: false })
  })

  it("respects explicit optimisticUpdate: false", () => {
    const key = getQueryKey("User", "findFirst", undefined, { infinite: false, optimisticUpdate: false })
    expect(key[4].optimisticUpdate).toBe(false)
  })
})

describe("Query Key Parsing", () => {
  it("parses valid zenstack query keys", () => {
    const key = ["zenstack", "User", "findMany", { take: 10 }, { infinite: false, optimisticUpdate: true }] as const
    const parsed = parseQueryKey(key)
    expect(parsed).toEqual({
      model: "User",
      operation: "findMany",
      args: { take: 10 },
      flags: { infinite: false, optimisticUpdate: true },
    })
  })

  it("returns undefined for non-zenstack query keys", () => {
    const key = ["tanstack", "User", "findMany", {}, {}] as const
    expect(parseQueryKey(key)).toBeUndefined()
  })

  it("roundtrips through getQueryKey and parseQueryKey", () => {
    const original = { where: { id: "1" }, include: { posts: true } }
    const key = getQueryKey("User", "findUnique", original)
    const parsed = parseQueryKey(key)
    expect(parsed?.model).toBe("User")
    expect(parsed?.operation).toBe("findUnique")
    expect(parsed?.args).toEqual(original)
  })
})

describe("isZenStackQueryKey", () => {
  it("accepts valid zenstack query keys", () => {
    const key = getQueryKey("User", "findMany", {})
    expect(isZenStackQueryKey(key)).toBe(true)
  })

  it("rejects keys with fewer than 5 elements", () => {
    expect(isZenStackQueryKey(["zenstack", "User"])).toBe(false)
    expect(isZenStackQueryKey(["zenstack", "User", "findMany", {}])).toBe(false)
  })

  it("rejects keys with wrong prefix", () => {
    expect(isZenStackQueryKey(["other", "User", "findMany", {}, {}])).toBe(false)
    expect(isZenStackQueryKey(["", "User", "findMany", {}, {}])).toBe(false)
  })
})
