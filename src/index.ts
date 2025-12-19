import type { GetModels, SchemaDef } from "@zenstackhq/schema";
import type {
  AggregateArgs,
  AggregateResult,
  BatchResult,
  ClientOptions,
  CountArgs,
  CountResult,
  CreateArgs,
  CreateManyAndReturnArgs,
  CreateManyArgs,
  DeleteArgs,
  DeleteManyArgs,
  FindFirstArgs,
  FindManyArgs,
  FindUniqueArgs,
  GroupByArgs,
  GroupByResult,
  SelectSubset,
  SimplifiedModelResult,
  Subset,
  UpdateArgs,
  UpdateManyAndReturnArgs,
  UpdateManyArgs,
  UpsertArgs,
} from "@zenstackhq/orm";
import { inject, provide, toValue, type MaybeRefOrGetter, type UnwrapRef } from "vue";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryCache,
  type UseMutationOptions,
  type UseMutationReturn,
  type UseQueryOptions,
  type UseQueryReturn,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturn,
  type EntryKey,
} from "@pinia/colada";
import { lowerCaseFirst } from "@zenstackhq/common-helpers";
import {
  DEFAULT_QUERY_ENDPOINT,
  getKey,
  makeUrl,
  type ExtraMutationOptions,
  type ExtraQueryOptions,
  type APIContext,
  fetcher,
  setupOptimisticUpdate,
  setupInvalidation,
  marshal,
} from "./utils/common";
import type { TrimDelegateModelOperations } from "./utils/types";

export type { FetchFn } from "./utils/common";
export const PiniaColadaContextKey = "zenstack-pinia-colada-context";

/**
 * Provide context for query settings.
 */
export function provideQuerySettingsContext(context: APIContext) {
  provide<APIContext>(PiniaColadaContextKey, context);
}

function getQuerySettings() {
  const { endpoint, ...rest } = inject<APIContext>(PiniaColadaContextKey, {
    endpoint: DEFAULT_QUERY_ENDPOINT,
    fetch: undefined,
    logging: false,
  });
  return { endpoint: endpoint ?? DEFAULT_QUERY_ENDPOINT, ...rest };
}

export type ClientHooks<Schema extends SchemaDef> = {
  [Model in GetModels<Schema> as `${Uncapitalize<Model>}`]: ModelQueryHooks<Schema, Model>;
};

export type ModelQueryOptions<T> = Omit<UseQueryOptions<T>, "key" | "query"> & ExtraQueryOptions;

export type ModelInfiniteQueryResult<T> = UseInfiniteQueryReturn<
  { items: T[]; nextCursor?: unknown },
  Error
> & {
  key: EntryKey;
};

export type ModelQueryResult<T> = UseQueryReturn<T> & { key: EntryKey };

export type ModelInfiniteQueryOptions<T> = Omit<
  UseInfiniteQueryOptions<T[], Error, T[] | undefined, { items: T[]; nextCursor?: unknown }>,
  "key" | "query" | "initialPage" | "merge"
>;

export type ModelMutationOptions<T, TArgs> = MaybeRefOrGetter<
  Omit<UnwrapRef<UseMutationOptions<T, TArgs>>, "mutation"> & ExtraMutationOptions
>;

export type ModelMutationResult<T, TArgs> = UseMutationReturn<T, TArgs, Error>;

export type ModelMutationModelResult<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  TArgs,
  Array extends boolean = false,
> = Omit<
  ModelMutationResult<
    SimplifiedModelResult<Schema, Model, ClientOptions<Schema>, TArgs, false, Array>,
    TArgs
  >,
  "mutateAsync"
> & {
  mutateAsync<T extends TArgs>(
    args: T,
    options?: ModelMutationOptions<
      SimplifiedModelResult<Schema, Model, ClientOptions<Schema>, T, false, Array>,
      T
    >,
  ): Promise<SimplifiedModelResult<Schema, Model, ClientOptions<Schema>, T, false, Array>>;
};

type MResult<Schema extends SchemaDef, Model extends GetModels<Schema>, T> = SimplifiedModelResult<
  Schema,
  Model,
  ClientOptions<Schema>,
  T
>;

export type ModelQueryHooks<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
> = TrimDelegateModelOperations<
  Schema,
  Model,
  {
    useFindUnique<T extends FindUniqueArgs<Schema, Model>>(
      args: MaybeRefOrGetter<SelectSubset<T, FindUniqueArgs<Schema, Model>>>,
      options?: ModelQueryOptions<MResult<Schema, Model, T> | null>,
    ): ModelQueryResult<MResult<Schema, Model, T> | null>;

    useFindFirst<T extends FindFirstArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindFirstArgs<Schema, Model>>>,
      options?: ModelQueryOptions<MResult<Schema, Model, T> | null>,
    ): ModelQueryResult<MResult<Schema, Model, T> | null>;

    useFindMany<T extends FindManyArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindManyArgs<Schema, Model>>>,
      options?: ModelQueryOptions<MResult<Schema, Model, T>[]>,
    ): ModelQueryResult<MResult<Schema, Model, T>[]>;

    useInfiniteFindMany<T extends FindManyArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindManyArgs<Schema, Model>>>,
      options?: ModelInfiniteQueryOptions<MResult<Schema, Model, T>[]>,
    ): ModelInfiniteQueryResult<MResult<Schema, Model, T>[]>;

    useCreate<T extends CreateArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>;

    useCreateMany<T extends CreateManyArgs<Schema, Model>>(
      options?: ModelMutationOptions<BatchResult, T>,
    ): ModelMutationResult<BatchResult, T>;

    useCreateManyAndReturn<T extends CreateManyAndReturnArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>[], T>,
    ): ModelMutationModelResult<Schema, Model, T, true>;

    useUpdate<T extends UpdateArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>;

    useUpdateMany<T extends UpdateManyArgs<Schema, Model>>(
      options?: ModelMutationOptions<BatchResult, T>,
    ): ModelMutationResult<BatchResult, T>;

    useUpdateManyAndReturn<T extends UpdateManyAndReturnArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>[], T>,
    ): ModelMutationModelResult<Schema, Model, T, true>;

    useUpsert<T extends UpsertArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>;

    useDelete<T extends DeleteArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>;

    useDeleteMany<T extends DeleteManyArgs<Schema, Model>>(
      options?: ModelMutationOptions<BatchResult, T>,
    ): ModelMutationResult<BatchResult, T>;

    useCount<T extends CountArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<Subset<T, CountArgs<Schema, Model>>>,
      options?: ModelQueryOptions<CountResult<Schema, Model, T>>,
    ): ModelQueryResult<CountResult<Schema, Model, T>>;

    useAggregate<T extends AggregateArgs<Schema, Model>>(
      args: MaybeRefOrGetter<Subset<T, AggregateArgs<Schema, Model>>>,
      options?: ModelQueryOptions<AggregateResult<Schema, Model, T>>,
    ): ModelQueryResult<AggregateResult<Schema, Model, T>>;

    useGroupBy<T extends GroupByArgs<Schema, Model>>(
      args: MaybeRefOrGetter<Subset<T, GroupByArgs<Schema, Model>>>,
      options?: ModelQueryOptions<GroupByResult<Schema, Model, T>>,
    ): ModelQueryResult<GroupByResult<Schema, Model, T>>;
  }
>;

export function useInternalQuery<TData>(
  _schema: SchemaDef,
  model: string,
  operation: string,
  args?: MaybeRefOrGetter<unknown>,
  options?: Omit<UseQueryOptions<TData>, "key" | "query"> & ExtraQueryOptions,
) {
  const { optimisticUpdate, ...restOptions } = options ?? {};
  const { endpoint, fetch } = getQuerySettings();

  // Make the key reactive by computing it from a getter
  const key = () => {
    const argsValue = toValue(args);
    return getKey(model, operation, argsValue, {
      infinite: false,
      optimisticUpdate: optimisticUpdate !== false,
    });
  };

  const finalOptions = {
    key: key,
    query: ({ signal }: { signal: AbortSignal }) => {
      const argsValue = toValue(args);
      const reqUrl = makeUrl(endpoint, model, operation, argsValue);
      return fetcher<TData>(reqUrl, { signal }, fetch);
    },
    ...restOptions,
  } as UseQueryOptions<TData>;

  return { key: key(), ...useQuery<TData>(finalOptions) };
}

export function useInternalInfiniteQuery<TData>(
  _schema: SchemaDef,
  model: string,
  operation: string,
  args: MaybeRefOrGetter<unknown>,
  options:
    | Omit<UseInfiniteQueryOptions<TData, Error>, "key" | "query" | "initialPage" | "merge">
    | undefined,
) {
  const { endpoint, fetch } = getQuerySettings();

  // Make the key reactive by computing it from a getter
  const key = () => {
    const argsValue = toValue(args);
    return getKey(model, operation, argsValue, { infinite: true, optimisticUpdate: false });
  };

  // Type for paginated results - contains items array and cursor info
  type PageState = {
    items: TData[];
    nextCursor?: unknown;
  };

  const finalOptions = {
    key: key,
    // Pinia Colada's infinite query: query receives accumulated pages and returns new page data
    query: async (pages: PageState, { signal }: { signal: AbortSignal }): Promise<TData[]> => {
      const argsValue = toValue(args) as Record<string, unknown> | undefined;
      // Build query args with cursor for pagination
      const pageArgs = pages.nextCursor ? { ...argsValue, cursor: pages.nextCursor } : argsValue;
      const reqUrl = makeUrl(endpoint, model, operation, pageArgs);
      return fetcher<TData[]>(reqUrl, { signal }, fetch);
    },
    // Initial page state
    initialPage: (): PageState => ({
      items: [],
      nextCursor: undefined,
    }),
    // Merge function: combines existing pages with new data
    merge: (result: PageState, current: TData[]): PageState => {
      // Extract cursor from last item if available (common pagination pattern)
      const lastItem = current[current.length - 1] as Record<string, unknown> | undefined;
      return {
        items: [...result.items, ...current],
        nextCursor: lastItem?.id, // Use last item's id as cursor for next page
      };
    },
    ...options,
  } as UseInfiniteQueryOptions<TData[], Error, TData[] | undefined, PageState>;

  return {
    key: key(),
    ...useInfiniteQuery(finalOptions),
  };
}

/**
 * Creates a Pinia Colada mutation
 *
 * @private
 *
 * @param model The name of the model under mutation.
 * @param method The HTTP method.
 * @param operation The mutation operation (e.g. `create`).
 * @param options The Pinia Colada mutation options.
 * @param checkReadBack Whether to check for read back errors and return undefined if found.
 */
export function useInternalMutation<TArgs, R = unknown>(
  schema: SchemaDef,
  model: string,
  method: "POST" | "PUT" | "DELETE",
  operation: string,
  options?: MaybeRefOrGetter<
    Omit<UnwrapRef<UseMutationOptions<R, TArgs>>, "mutation"> & ExtraMutationOptions
  >,
) {
  const { endpoint, fetch, logging } = getQuerySettings();
  const queryCache = useQueryCache();
  const mutation = (data: TArgs): Promise<R> => {
    const reqUrl =
      method === "DELETE"
        ? makeUrl(endpoint, model, operation, data)
        : makeUrl(endpoint, model, operation);
    const fetchInit: RequestInit = {
      method,
      ...(method !== "DELETE" && {
        headers: {
          "content-type": "application/json",
        },
        body: marshal(data),
      }),
    };
    return fetcher<R>(reqUrl, fetchInit, fetch) as Promise<R>;
  };

  const optionsValue = toValue(options);
  const finalOptions = { ...optionsValue, mutation } as UseMutationOptions<R, TArgs>;
  const invalidateQueries = optionsValue?.invalidateQueries !== false;
  const optimisticUpdate = !!optionsValue?.optimisticUpdate;

  if (operation) {
    if (invalidateQueries) {
      setupInvalidation(
        model,
        operation,
        schema,
        finalOptions,
        async (predicate) => {
          await queryCache.invalidateQueries({
            predicate: (entry) => predicate({ key: entry.key as readonly unknown[] }),
          });
        },
        logging,
      );
    }

    if (optimisticUpdate) {
      setupOptimisticUpdate(
        model,
        operation,
        schema,
        finalOptions,
        queryCache.getEntries().map((entry) => ({
          key: entry.key as readonly unknown[],
          state: {
            data: entry.state.value.data,
            error: entry.state.value.error,
          },
        })),
        (key, data) => {
          // update query cache
          queryCache.setQueryData(key as EntryKey, data);
          // cancel on-flight queries to avoid redundant cache updates,
          // the settlement of the current mutation will trigger a new revalidation
          queryCache.cancelQueries({ key: key as EntryKey });
        },
        invalidateQueries
          ? async (predicate) => {
              await queryCache.invalidateQueries({
                predicate: (entry) => predicate({ key: entry.key as readonly unknown[] }),
              });
            }
          : undefined,
        logging,
      );
    }
  }

  return useMutation(finalOptions);
}

/**
 * Gets data query hooks for all models in the schema.
 */
export function useClientQueries<Schema extends SchemaDef>(schema: Schema): ClientHooks<Schema> {
  return Object.keys(schema.models).reduce(
    (acc, model) => {
      (acc as Record<string, unknown>)[lowerCaseFirst(model)] = useModelQueries(
        schema,
        model as GetModels<Schema>,
      );
      return acc;
    },
    {} as ClientHooks<Schema>,
  );
}

/**
 * Gets data query hooks for a specific model in the schema.
 */
export function useModelQueries<Schema extends SchemaDef, Model extends GetModels<Schema>>(
  schema: Schema,
  model: Model,
): ModelQueryHooks<Schema, Model> {
  const modelDef = Object.values(schema.models).find(
    (m) => m.name.toLowerCase() === model.toLowerCase(),
  );
  if (!modelDef) {
    throw new Error(`Model "${model}" not found in schema`);
  }

  const modelName = modelDef.name;

  return {
    useFindUnique: (args, options?) => {
      return useInternalQuery(schema, modelName, "findUnique", args, options);
    },

    useFindFirst: (args, options?) => {
      return useInternalQuery(schema, modelName, "findFirst", args, options);
    },

    useFindMany: (args, options?) => {
      return useInternalQuery(schema, modelName, "findMany", args, options);
    },

    useInfiniteFindMany: (args, options?) => {
      return useInternalInfiniteQuery(
        schema,
        modelName,
        "findMany",
        args,
        options as
          | Omit<UseInfiniteQueryOptions<unknown, Error>, "key" | "query" | "initialPageParam">
          | undefined,
      );
    },

    useCreate: (options?) => {
      return useInternalMutation(schema, modelName, "POST", "create", options);
    },

    useCreateMany: (options?) => {
      return useInternalMutation(schema, modelName, "POST", "createMany", options);
    },

    useCreateManyAndReturn: (options?: any) => {
      return useInternalMutation(schema, modelName, "POST", "createManyAndReturn", options);
    },

    useUpdate: (options?) => {
      return useInternalMutation(schema, modelName, "PUT", "update", options);
    },

    useUpdateMany: (options?) => {
      return useInternalMutation(schema, modelName, "PUT", "updateMany", options);
    },

    useUpdateManyAndReturn: (options?: any) => {
      return useInternalMutation(schema, modelName, "PUT", "updateManyAndReturn", options);
    },

    useUpsert: (options?) => {
      return useInternalMutation(schema, modelName, "POST", "upsert", options);
    },

    useDelete: (options?) => {
      return useInternalMutation(schema, modelName, "DELETE", "delete", options);
    },

    useDeleteMany: (options?) => {
      return useInternalMutation(schema, modelName, "DELETE", "deleteMany", options);
    },

    useCount: (args, options?) => {
      return useInternalQuery(schema, modelName, "count", args, options);
    },

    useAggregate: (args, options?) => {
      return useInternalQuery(schema, modelName, "aggregate", args, options);
    },

    useGroupBy: (args, options?) => {
      return useInternalQuery(schema, modelName, "groupBy", args, options);
    },
  } as ModelQueryHooks<Schema, Model>;
}
