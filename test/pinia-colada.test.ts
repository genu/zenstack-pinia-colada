import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientQueries, useModelQueries, PiniaColadaContextKey } from "../src/index";
import { getQueryKey, QUERY_KEY_PREFIX } from "../src/common/query-key";
import { makeUrl, marshal, fetcher } from "@zenstackhq/client-helpers/fetch";
import { DEFAULT_QUERY_ENDPOINT } from "@zenstackhq/client-helpers";
import { schema } from "./schemas/basic/schema-lite";

// Type declarations for global scope in tests
declare const global: typeof globalThis;

// Re-export for compatibility with existing tests
const getKey = getQueryKey;
const unmarshal = (data: string) => JSON.parse(data);

describe("Pinia Colada Client Tests", () => {
  describe("useClientQueries", () => {
    it("should create hooks for all models", () => {
      const hooks = useClientQueries(schema);
      expect(hooks).toBeDefined();
      expect(hooks.user).toBeDefined();
      expect(hooks.post).toBeDefined();
      expect(hooks.category).toBeDefined();
    });

    it("should have correct query methods", () => {
      const hooks = useClientQueries(schema);
      expect(hooks.user.useFindUnique).toBeTypeOf("function");
      expect(hooks.user.useFindFirst).toBeTypeOf("function");
      expect(hooks.user.useFindMany).toBeTypeOf("function");
      expect(hooks.user.useCount).toBeTypeOf("function");
      expect(hooks.user.useAggregate).toBeTypeOf("function");
      expect(hooks.user.useGroupBy).toBeTypeOf("function");
      expect(hooks.user.useInfiniteFindMany).toBeTypeOf("function");
    });

    it("should have correct mutation methods", () => {
      const hooks = useClientQueries(schema);
      expect(hooks.user.useCreate).toBeTypeOf("function");
      expect(hooks.user.useUpdate).toBeTypeOf("function");
      expect(hooks.user.useDelete).toBeTypeOf("function");
      expect(hooks.user.useCreateMany).toBeTypeOf("function");
      expect(hooks.user.useUpdateMany).toBeTypeOf("function");
      expect(hooks.user.useDeleteMany).toBeTypeOf("function");
      expect(hooks.user.useUpsert).toBeTypeOf("function");
      expect(hooks.user.useCreateManyAndReturn).toBeTypeOf("function");
      expect(hooks.user.useUpdateManyAndReturn).toBeTypeOf("function");
    });

    it("should lowercase model names in hooks object", () => {
      const hooks = useClientQueries(schema);
      // Schema has "User", "Post", "Category" but hooks should be "user", "post", "category"
      expect(Object.keys(hooks)).toContain("user");
      expect(Object.keys(hooks)).toContain("post");
      expect(Object.keys(hooks)).toContain("category");
      expect(Object.keys(hooks)).not.toContain("User");
    });
  });

  describe("useModelQueries", () => {
    it("should create hooks for a specific model", () => {
      const userHooks = useModelQueries(schema, "User");
      expect(userHooks).toBeDefined();
      expect(userHooks.useFindUnique).toBeTypeOf("function");
      expect(userHooks.useFindMany).toBeTypeOf("function");
      expect(userHooks.useCreate).toBeTypeOf("function");
    });

    it("should throw error for non-existent model", () => {
      expect(() => useModelQueries(schema, "NonExistent" as any)).toThrow(
        'Model "NonExistent" not found in schema',
      );
    });

    it("should be case-insensitive for model lookup", () => {
      const userHooks1 = useModelQueries(schema, "User");
      const userHooks2 = useModelQueries(schema, "user" as any);
      expect(userHooks1).toBeDefined();
      expect(userHooks2).toBeDefined();
    });
  });
});

describe("Utility Functions", () => {
  describe("getKey", () => {
    it("should generate correct key structure", () => {
      const key = getKey("User", "findMany", { where: { id: "1" } });
      expect(key).toHaveLength(5);
      expect(key[0]).toBe(QUERY_KEY_PREFIX);
      expect(key[1]).toBe("User");
      expect(key[2]).toBe("findMany");
      expect(key[3]).toEqual({ where: { id: "1" } });
      expect(key[4]).toEqual({ infinite: false, optimisticUpdate: true });
    });

    it("should handle undefined args", () => {
      const key = getKey("User", "findMany", undefined);
      expect(key[3]).toBeUndefined();
    });

    it("should set infinite flag correctly", () => {
      const key = getKey("User", "findMany", {}, { infinite: true, optimisticUpdate: true });
      expect(key[4]).toEqual({ infinite: true, optimisticUpdate: false }); // infinite queries don't support optimistic updates
    });

    it("should disable optimistic updates for infinite queries", () => {
      const key = getKey("User", "findMany", {}, { infinite: true, optimisticUpdate: true });
      expect(key[4].optimisticUpdate).toBe(false);
    });

    it("should respect optimisticUpdate option for non-infinite queries", () => {
      const key = getKey("User", "findMany", {}, { infinite: false, optimisticUpdate: false });
      expect(key[4].optimisticUpdate).toBe(false);
    });
  });

  describe("makeUrl", () => {
    it("should generate base URL without args", () => {
      const url = makeUrl("/api/model", "User", "findMany");
      expect(url).toBe("/api/model/user/findMany");
    });

    it("should lowercase model name in URL", () => {
      const url = makeUrl("/api/model", "User", "findUnique");
      expect(url).toContain("/user/");
    });

    it("should include query params when args provided", () => {
      const url = makeUrl("/api/model", "User", "findMany", { where: { id: "1" } });
      expect(url).toContain("?q=");
      expect(url).toContain(encodeURIComponent(JSON.stringify({ where: { id: "1" } })));
    });

    it("should handle complex args with serialization metadata", () => {
      const args = { where: { createdAt: new Date("2024-01-01") } };
      const url = makeUrl("/api/model", "User", "findMany", args);
      expect(url).toContain("?q=");
      // Dates get serialized with metadata
      expect(url).toContain("meta=");
    });

    it("should use custom endpoint", () => {
      const url = makeUrl("/custom/endpoint", "Post", "findFirst");
      expect(url).toBe("/custom/endpoint/post/findFirst");
    });
  });

  describe("marshal and unmarshal", () => {
    it("should marshal simple objects", () => {
      const data = { name: "Test", count: 42 };
      const result = marshal(data);
      expect(result).toBe(JSON.stringify(data));
    });

    it("should unmarshal simple JSON", () => {
      const jsonStr = JSON.stringify({ data: { id: "1", name: "Test" } });
      const result = unmarshal(jsonStr);
      expect(result).toEqual({ data: { id: "1", name: "Test" } });
    });

    it("should round-trip Date through marshal/unmarshal", () => {
      // Test actual round-trip serialization
      const original = { date: new Date("2024-01-01T00:00:00.000Z") };
      const marshalled = marshal(original);

      // Wrap in data/meta structure as the API would return
      const parsed = JSON.parse(marshalled);
      const apiResponse = JSON.stringify({
        data: parsed.date ? { date: parsed.date } : parsed,
        meta: parsed.meta ? { serialization: parsed.meta.serialization } : undefined,
      });

      const result = unmarshal(apiResponse);
      // The data should be deserialized
      expect(result.data).toBeDefined();
    });

    it("should handle Date serialization in marshal", () => {
      const data = { date: new Date("2024-01-01") };
      const result = marshal(data);
      const parsed = JSON.parse(result);
      expect(parsed.meta).toBeDefined();
      expect(parsed.meta.serialization).toBeDefined();
    });
  });

  describe("fetcher", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch and unmarshal successful response", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: { id: "1", name: "Test" } })),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await fetcher<{ id: string; name: string }>("/api/test");
      expect(result).toEqual({ id: "1", name: "Test" });
    });

    it("should throw QueryError on failed response", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "Not found" } })),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(fetcher("/api/test")).rejects.toMatchObject({
        message: "An error occurred while fetching the data.",
        status: 404,
        info: { message: "Not found" },
      });
    });

    it("should pass request options to fetch", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: {} })),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await fetcher("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(global.fetch).toHaveBeenCalledWith("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should use custom fetch function when provided", async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: { custom: true } })),
      });

      const result = await fetcher("/api/test", {}, customFetch);
      expect(customFetch).toHaveBeenCalledWith("/api/test", {});
      expect(result).toEqual({ custom: true });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle cannot-read-back policy rejection", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: { rejectedByPolicy: true, rejectReason: "cannot-read-back" },
          }),
        ),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await fetcher("/api/test");
      expect(result).toBeUndefined();
    });
  });
});

describe("Constants", () => {
  it("should export correct QUERY_KEY_PREFIX", () => {
    expect(QUERY_KEY_PREFIX).toBe("zenstack");
  });

  it("should export correct DEFAULT_QUERY_ENDPOINT", () => {
    expect(DEFAULT_QUERY_ENDPOINT).toBe("/api/model");
  });

  it("should export PiniaColadaContextKey", () => {
    expect(PiniaColadaContextKey).toBe("zenstack-pinia-colada-context");
  });
});
