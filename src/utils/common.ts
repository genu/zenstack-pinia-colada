import { lowerCaseFirst } from "@zenstackhq/common-helpers";
import type { SchemaDef } from "@zenstackhq/schema";
import { applyMutation } from "./mutator";
import { getMutatedModels, getReadModels } from "./query-analysis";
import { deserialize, serialize } from "./serialization";
import type { ORMWriteActionType } from "./types";

/**
 * The default query endpoint.
 */
export const DEFAULT_QUERY_ENDPOINT = "/api/model";

/**
 * Prefix for query keys.
 */
export const QUERY_KEY_PREFIX = "zenstack";

/**
 * Function signature for `fetch`.
 */
export type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Type for query and mutation errors.
 */
export type QueryError = Error & {
  /**
   * Additional error information.
   */
  info?: unknown;

  /**
   * HTTP status code.
   */
  status?: number;
};

/**
 * Result of optimistic data provider.
 */
export type OptimisticDataProviderResult = {
  /**
   * Kind of the result.
   *   - Update: use the `data` field to update the query cache.
   *   - Skip: skip the optimistic update for this query.
   *   - ProceedDefault: proceed with the default optimistic update.
   */
  kind: "Update" | "Skip" | "ProceedDefault";

  /**
   * Data to update the query cache. Only applicable if `kind` is 'Update'.
   *
   * If the data is an object with fields updated, it should have a `$optimistic`
   * field set to `true`. If it's an array and an element object is created or updated,
   * the element should have a `$optimistic` field set to `true`.
   */
  data?: any;
};

/**
 * Optimistic data provider.
 *
 * @param args Arguments.
 * @param args.queryModel The model of the query.
 * @param args.queryOperation The operation of the query, `findMany`, `count`, etc.
 * @param args.queryArgs The arguments of the query.
 * @param args.currentData The current cache data for the query.
 * @param args.mutationArgs The arguments of the mutation.
 */
export type OptimisticDataProvider = (args: {
  queryModel: string;
  queryOperation: string;
  queryArgs: any;
  currentData: any;
  mutationArgs: any;
}) => OptimisticDataProviderResult | Promise<OptimisticDataProviderResult>;

/**
 * Extra mutation options.
 */
export type ExtraMutationOptions = {
  /**
   * Whether to automatically invalidate queries potentially affected by the mutation. Defaults to `true`.
   */
  invalidateQueries?: boolean;

  /**
   * Whether to optimistically update queries potentially affected by the mutation. Defaults to `false`.
   */
  optimisticUpdate?: boolean;

  /**
   * A callback for computing optimistic update data for each query cache entry.
   */
  optimisticDataProvider?: OptimisticDataProvider;
};

/**
 * Extra query options.
 */
export type ExtraQueryOptions = {
  /**
   * Whether to opt-in to optimistic updates for this query. Defaults to `true`.
   */
  optimisticUpdate?: boolean;
};

/**
 * Context type for configuring the hooks.
 */
export type APIContext = {
  /**
   * The endpoint to use for the queries.
   */
  endpoint?: string;

  /**
   * A custom fetch function for sending the HTTP requests.
   */
  fetch?: FetchFn;

  /**
   * If logging is enabled.
   */
  logging?: boolean;
};

export async function fetcher<R>(
  url: string,
  options?: RequestInit,
  customFetch?: FetchFn,
): Promise<R> {
  const _fetch = customFetch ?? fetch;
  const res = await _fetch(url, options);
  if (!res.ok) {
    const errData = unmarshal(await res.text());
    if (errData.error?.rejectedByPolicy && errData.error?.rejectReason === "cannot-read-back") {
      // policy doesn't allow mutation result to be read back, just return undefined
      return undefined as any;
    }
    const error: QueryError = new Error("An error occurred while fetching the data.");
    error.info = errData.error;
    error.status = res.status;
    throw error;
  }

  const textResult = await res.text();
  try {
    return unmarshal(textResult).data as R;
  } catch (err) {
    console.error(`Unable to deserialize data:`, textResult);
    throw err;
  }
}

type Key = [
  string /* prefix */,
  string /* model */,
  string /* operation */,
  unknown /* args */,
  {
    infinite: boolean;
    optimisticUpdate: boolean;
  } /* flags */,
];

/**
 * Computes key for the given model, operation and query args.
 * @param model Model name.
 * @param operation Query operation (e.g, `findMany`) or request URL. If it's a URL, the last path segment will be used as the operation name.
 * @param args Query arguments.
 * @param options Query options, including `infinite` indicating if it's an infinite query (defaults to false), and `optimisticUpdate` indicating if optimistic updates are enabled (defaults to true).
 * @returns Key
 */
export function getKey(
  model: string,
  operation: string,
  args: unknown,
  options: { infinite: boolean; optimisticUpdate: boolean } = {
    infinite: false,
    optimisticUpdate: true,
  },
): Key {
  const infinite = options.infinite;
  // infinite query doesn't support optimistic updates
  const optimisticUpdate = options.infinite ? false : options.optimisticUpdate;
  return [QUERY_KEY_PREFIX, model, operation!, args, { infinite, optimisticUpdate }];
}

export function marshal(value: unknown) {
  const { data, meta } = serialize(value);
  if (meta) {
    return JSON.stringify({ ...(data as any), meta: { serialization: meta } });
  } else {
    return JSON.stringify(data);
  }
}

export function unmarshal(value: string) {
  const parsed = JSON.parse(value);
  if (typeof parsed === "object" && parsed?.data && parsed?.meta?.serialization) {
    const deserializedData = deserialize(parsed.data, parsed.meta.serialization);
    return { ...parsed, data: deserializedData };
  } else {
    return parsed;
  }
}

export function makeUrl(endpoint: string, model: string, operation: string, args?: unknown) {
  const baseUrl = `${endpoint}/${lowerCaseFirst(model)}/${operation}`;
  if (!args) {
    return baseUrl;
  }

  const { data, meta } = serialize(args);
  let result = `${baseUrl}?q=${encodeURIComponent(JSON.stringify(data))}`;
  if (meta) {
    result += `&meta=${encodeURIComponent(JSON.stringify({ serialization: meta }))}`;
  }
  return result;
}

type InvalidationPredicate = ({ key }: { key: readonly unknown[] }) => boolean;
type InvalidateFunc = (predicate: InvalidationPredicate) => Promise<void>;

/**
 * Pinia Colada mutation hook signatures.
 * @see https://pinia-colada.esm.dev/guide/mutations.html
 */

type MutationHooks = Record<string, any> & {
  onMutate?: (...args: any[]) => any;

  onSuccess?: (...args: any[]) => any;

  onError?: (...args: any[]) => any;

  onSettled?: (...args: any[]) => any;
};

// sets up invalidation hook for a mutation
export function setupInvalidation(
  model: string,
  operation: string,
  schema: SchemaDef,
  options: MutationHooks,
  invalidate: InvalidateFunc,
  logging = false,
) {
  const origOnSuccess = options?.onSuccess;
  options.onSuccess = async (...args: unknown[]) => {
    // Pinia Colada: onSuccess(data, vars, context) - vars is second arg
    const vars = args[1];
    const predicate = await getInvalidationPredicate(
      model,
      operation as ORMWriteActionType,
      vars,
      schema,
      logging,
    );
    await invalidate(predicate);
    return origOnSuccess?.(...args);
  };
}

// gets a predicate for evaluating whether a query should be invalidated
async function getInvalidationPredicate(
  model: string,
  operation: ORMWriteActionType,
  mutationArgs: unknown,
  schema: SchemaDef,
  logging = false,
) {
  const mutatedModels = await getMutatedModels(model, operation, mutationArgs, schema);

  return ({ key }: { key: readonly unknown[] }) => {
    const [_, queryModel, , args] = key as Key;

    if (mutatedModels.includes(queryModel)) {
      // direct match
      if (logging) {
        console.log(
          `Invalidating query ${JSON.stringify(key)} due to mutation "${model}.${operation}"`,
        );
      }
      return true;
    }

    if (args) {
      // traverse query args to find nested reads that match the model under mutation
      if (findNestedRead(queryModel, mutatedModels, schema, args)) {
        if (logging) {
          console.log(
            `Invalidating query ${JSON.stringify(key)} due to mutation "${model}.${operation}"`,
          );
        }
        return true;
      }
    }

    return false;
  };
}

// find nested reads that match the given models
function findNestedRead(
  visitingModel: string,
  targetModels: string[],
  schema: SchemaDef,
  args: any,
) {
  const modelsRead = getReadModels(visitingModel, schema, args);
  return targetModels.some((m) => modelsRead.includes(m));
}

type CacheEntry = {
  key: readonly unknown[];
  state: {
    data: unknown;
    error: unknown;
  };
}[];

type SetCacheFunc = (key: readonly unknown[], data: unknown) => void;

/**
 * Sets up optimistic update and invalidation (after settled) for a mutation.
 */
export function setupOptimisticUpdate(
  model: string,
  operation: string,
  schema: SchemaDef,
  options: MutationHooks & ExtraMutationOptions,
  cacheEntries: CacheEntry,
  setCache: SetCacheFunc,
  invalidate?: InvalidateFunc,
  logging = false,
) {
  const origOnMutate = options?.onMutate;
  const origOnSettled = options?.onSettled;

  // optimistic update on mutate
  options.onMutate = async (...args: unknown[]) => {
    // Pinia Colada: onMutate(vars, context) - vars is first arg
    const vars = args[0];
    await optimisticUpdate(
      model,
      operation as ORMWriteActionType,
      vars,
      options,
      schema,
      cacheEntries,
      setCache,
      logging,
    );
    return origOnMutate?.(...args);
  };

  // invalidate on settled
  options.onSettled = async (...args: unknown[]) => {
    if (invalidate) {
      // Pinia Colada: onSettled(data, error, vars, context) - vars is third arg
      const vars = args[2];
      const predicate = await getInvalidationPredicate(
        model,
        operation as ORMWriteActionType,
        vars,
        schema,
        logging,
      );
      await invalidate(predicate);
    }
    return origOnSettled?.(...args);
  };
}

// optimistically updates cache
async function optimisticUpdate(
  mutationModel: string,
  mutationOp: string,
  mutationArgs: unknown,
  options: MutationHooks & ExtraMutationOptions,
  schema: SchemaDef,
  cacheEntries: CacheEntry,
  setCache: SetCacheFunc,
  logging = false,
) {
  for (const cacheItem of cacheEntries) {
    const {
      key,
      state: { data, error },
    } = cacheItem;

    if (!isZenStackKey(key)) {
      // skip non-zenstack queries
      continue;
    }

    if (error) {
      if (logging) {
        console.warn(`Skipping optimistic update for ${JSON.stringify(key)} due to error:`, error);
      }
      continue;
    }

    const [_, queryModel, queryOperation, queryArgs, queryOptions] = key;
    if (!queryOptions?.optimisticUpdate) {
      if (logging) {
        console.log(`Skipping optimistic update for ${JSON.stringify(key)} due to opt-out`);
      }
      continue;
    }

    if (options.optimisticDataProvider) {
      const providerResult = await options.optimisticDataProvider({
        queryModel,
        queryOperation,
        queryArgs,
        currentData: data,
        mutationArgs,
      });

      if (providerResult?.kind === "Skip") {
        // skip
        if (logging) {
          console.log(`Skipping optimistic update for ${JSON.stringify(key)} due to provider`);
        }
        continue;
      } else if (providerResult?.kind === "Update") {
        // update cache
        if (logging) {
          console.log(`Optimistically updating query ${JSON.stringify(key)} due to provider`);
        }
        setCache(key, providerResult.data);
        continue;
      }
    }

    // proceed with default optimistic update
    const mutatedData = await applyMutation(
      queryModel,
      queryOperation,
      data,
      mutationModel,
      mutationOp as ORMWriteActionType,
      mutationArgs,
      schema,
      logging,
    );

    if (mutatedData !== undefined) {
      // mutation applicable to this query, update cache
      if (logging) {
        console.log(
          `Optimistically updating query ${JSON.stringify(key)} due to mutation "${mutationModel}.${mutationOp}"`,
        );
      }
      setCache(key, mutatedData);
    }
  }
}

function isZenStackKey(key: readonly unknown[]): key is Key {
  if (key.length < 5) {
    return false;
  }

  if (key[0] !== QUERY_KEY_PREFIX) {
    return false;
  }

  return true;
}
