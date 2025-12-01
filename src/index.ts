import type { GetModels, SchemaDef } from "@zenstackhq/schema"
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
  FindArgs,
  FindUniqueArgs,
  GroupByArgs,
  GroupByResult,
  ModelResult,
  SelectSubset,
  Subset,
  UpdateArgs,
  UpdateManyAndReturnArgs,
  UpdateManyArgs,
  UpsertArgs,
} from "@zenstackhq/orm"
import { inject, provide, toValue, type MaybeRefOrGetter, type UnwrapRef } from "vue"
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
} from "@pinia/colada"
import { lowerCaseFirst } from "@zenstackhq/common-helpers"
import {
  DEFAULT_QUERY_ENDPOINT,
  getQueryKey,
  makeUrl,
  type ExtraMutationOptions,
  type ExtraQueryOptions,
  type APIContext,
  fetcher,
  setupOptimisticUpdate,
  setupInvalidation,
  marshal,
} from "./utils/common"
import type { TrimDelegateModelOperations } from "./utils/types"

export type { FetchFn } from "./utils/common"
export const PiniaColadaContextKey = "zenstack-pinia-colada-context"

/**
 * Provide context for query settings.
 */
export function provideQuerySettingsContext(context: APIContext) {
  provide<APIContext>(PiniaColadaContextKey, context)
}

function getQuerySettings() {
  const { endpoint, ...rest } = inject<APIContext>(PiniaColadaContextKey, {
    endpoint: DEFAULT_QUERY_ENDPOINT,
    fetch: undefined,
    logging: false,
  })
  return { endpoint: endpoint ?? DEFAULT_QUERY_ENDPOINT, ...rest }
}

export type ClientHooks<Schema extends SchemaDef> = {
  [Model in GetModels<Schema> as `${Uncapitalize<Model>}`]: ModelQueryHooks<Schema, Model>
}

export type ModelQueryOptions<T> = Omit<UseQueryOptions<T>, "key" | "query"> & ExtraQueryOptions

export type ModelInfiniteQueryResult<T> = UseInfiniteQueryReturn<T> & { queryKey: EntryKey }

export type ModelQueryResult<T> = UseQueryReturn<T> & { queryKey: EntryKey }

export type ModelInfiniteQueryOptions<T> = Omit<UseInfiniteQueryOptions<T, Error>, "key" | "query" | "initialPageParam">

export type ModelMutationOptions<T, TArgs> = MaybeRefOrGetter<
  Omit<UnwrapRef<UseMutationOptions<T, TArgs>>, "mutation"> & ExtraMutationOptions
>

export type ModelMutationResult<T, TArgs> = UseMutationReturn<T, TArgs, Error>

export type ModelMutationModelResult<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  TArgs,
  Array extends boolean = false,
  TResult = ModelResult<Schema, Model, ClientOptions<Schema>, TArgs>,
> = Omit<ModelMutationResult<TResult, TArgs>, "mutateAsync"> & {
  mutateAsync<T extends TArgs>(
    args: T,
    options?: ModelMutationOptions<ModelResult<Schema, Model, ClientOptions<Schema>, T>, T>,
  ): Promise<Array extends true ? ModelResult<Schema, Model, ClientOptions<Schema>, T>[] : ModelResult<Schema, Model, ClientOptions<Schema>, T>>
}

type MResult<Schema extends SchemaDef, Model extends GetModels<Schema>, T> = ModelResult<
  Schema,
  Model,
  ClientOptions<Schema>,
  T
>

export type ModelQueryHooks<Schema extends SchemaDef, Model extends GetModels<Schema>> = TrimDelegateModelOperations<
  Schema,
  Model,
  {
    useFindUnique<T extends FindUniqueArgs<Schema, Model>>(
      args: MaybeRefOrGetter<SelectSubset<T, FindUniqueArgs<Schema, Model>>>,
      options?: ModelQueryOptions<MResult<Schema, Model, T> | null>,
    ): ModelQueryResult<MResult<Schema, Model, T> | null>

    useFindFirst<T extends FindArgs<Schema, Model, false>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindArgs<Schema, Model, false>>>,
      options?: ModelQueryOptions<MResult<Schema, Model, T> | null>,
    ): ModelQueryResult<MResult<Schema, Model, T> | null>

    useFindMany<T extends FindArgs<Schema, Model, true>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindArgs<Schema, Model, true>>>,
      options?: ModelQueryOptions<MResult<Schema, Model, T>[]>,
    ): ModelQueryResult<MResult<Schema, Model, T>[]>

    useInfiniteFindMany<T extends FindArgs<Schema, Model, true>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindArgs<Schema, Model, true>>>,
      options?: ModelInfiniteQueryOptions<MResult<Schema, Model, T>[]>,
    ): ModelInfiniteQueryResult<MResult<Schema, Model, T>[]>

    useCreate<T extends CreateArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>

    useCreateMany<T extends CreateManyArgs<Schema, Model>>(
      options?: ModelMutationOptions<BatchResult, T>,
    ): ModelMutationResult<BatchResult, T>

    useCreateManyAndReturn<T extends CreateManyAndReturnArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>[], T>,
    ): ModelMutationModelResult<Schema, Model, T, true>

    useUpdate<T extends UpdateArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>

    useUpdateMany<T extends UpdateManyArgs<Schema, Model>>(
      options?: ModelMutationOptions<BatchResult, T>,
    ): ModelMutationResult<BatchResult, T>

    useUpdateManyAndReturn<T extends UpdateManyAndReturnArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>[], T>,
    ): ModelMutationModelResult<Schema, Model, T, true>

    useUpsert<T extends UpsertArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>

    useDelete<T extends DeleteArgs<Schema, Model>>(
      options?: ModelMutationOptions<MResult<Schema, Model, T>, T>,
    ): ModelMutationModelResult<Schema, Model, T>

    useDeleteMany<T extends DeleteManyArgs<Schema, Model>>(
      options?: ModelMutationOptions<BatchResult, T>,
    ): ModelMutationResult<BatchResult, T>

    useCount<T extends CountArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<Subset<T, CountArgs<Schema, Model>>>,
      options?: ModelQueryOptions<CountResult<Schema, Model, T>>,
    ): ModelQueryResult<CountResult<Schema, Model, T>>

    useAggregate<T extends AggregateArgs<Schema, Model>>(
      args: MaybeRefOrGetter<Subset<T, AggregateArgs<Schema, Model>>>,
      options?: ModelQueryOptions<AggregateResult<Schema, Model, T>>,
    ): ModelQueryResult<AggregateResult<Schema, Model, T>>

    useGroupBy<T extends GroupByArgs<Schema, Model>>(
      args: MaybeRefOrGetter<Subset<T, GroupByArgs<Schema, Model>>>,
      options?: ModelQueryOptions<GroupByResult<Schema, Model, T>>,
    ): ModelQueryResult<GroupByResult<Schema, Model, T>>
  }
>

export function useInternalQuery<TQueryFnData>(
  _schema: SchemaDef,
  model: string,
  operation: string,
  args?: MaybeRefOrGetter<unknown>,
  options?: Omit<UseQueryOptions<TQueryFnData>, "key" | "query"> & ExtraQueryOptions,
) {
  const { optimisticUpdate, ...restOptions } = options ?? {}
  const { endpoint, fetch } = getQuerySettings()

  // Make the query key reactive by computing it from a getter
  const queryKey = () => {
    const argsValue = toValue(args)
    return getQueryKey(model, operation, argsValue, {
      infinite: false,
      optimisticUpdate: optimisticUpdate !== false,
    })
  }

  const finalOptions = {
    key: queryKey,
    query: ({ signal }: { signal: AbortSignal }) => {
      const argsValue = toValue(args)
      const reqUrl = makeUrl(endpoint, model, operation, argsValue)
      return fetcher<TQueryFnData>(reqUrl, { signal }, fetch)
    },
    ...restOptions,
  } as UseQueryOptions<TQueryFnData>

  return { queryKey: queryKey(), ...useQuery<TQueryFnData>(finalOptions) }
}

export function useInternalInfiniteQuery<TQueryFnData>(
  _schema: SchemaDef,
  model: string,
  operation: string,
  args: MaybeRefOrGetter<unknown>,
  options: Omit<UseInfiniteQueryOptions<TQueryFnData, Error>, "key" | "query" | "initialPageParam"> | undefined,
) {
  const { endpoint, fetch } = getQuerySettings()

  // Make the query key reactive by computing it from a getter
  const queryKey = () => {
    const argsValue = toValue(args)
    return getQueryKey(model, operation, argsValue, { infinite: true, optimisticUpdate: false })
  }

  const finalOptions = {
    key: queryKey,
    query: ({ signal, nextPage }: { signal: AbortSignal; nextPage: unknown }) => {
      const argsValue = toValue(args)
      const pageArgs = nextPage !== undefined ? nextPage : argsValue
      const reqUrl = makeUrl(endpoint, model, operation, pageArgs)
      return fetcher<TQueryFnData>(reqUrl, { signal }, fetch)
    },
    initialPageParam: () => toValue(args),
    ...options,
  } as UseInfiniteQueryOptions<TQueryFnData, Error>

  return {
    queryKey: queryKey(),
    ...useInfiniteQuery(finalOptions),
  }
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
  options?: MaybeRefOrGetter<Omit<UnwrapRef<UseMutationOptions<R, TArgs>>, "mutation"> & ExtraMutationOptions>,
) {
  const { endpoint, fetch, logging } = getQuerySettings()
  const queryCache = useQueryCache()
  const mutation = (data: TArgs): Promise<R> => {
    const reqUrl = method === "DELETE" ? makeUrl(endpoint, model, operation, data) : makeUrl(endpoint, model, operation)
    const fetchInit: RequestInit = {
      method,
      ...(method !== "DELETE" && {
        headers: {
          "content-type": "application/json",
        },
        body: marshal(data),
      }),
    }
    return fetcher<R>(reqUrl, fetchInit, fetch) as Promise<R>
  }

  const optionsValue = toValue(options)
  const finalOptions = { ...optionsValue, mutation } as UseMutationOptions<R, TArgs>
  const invalidateQueries = optionsValue?.invalidateQueries !== false
  const optimisticUpdate = !!optionsValue?.optimisticUpdate

  if (operation) {
    if (invalidateQueries) {
      setupInvalidation(
        model,
        operation,
        schema,
        finalOptions,
        async (predicate) => {
          await queryCache.invalidateQueries({
            predicate: (entry) => predicate({ queryKey: entry.key as readonly unknown[] }),
          })
        },
        logging,
      )
    }

    if (optimisticUpdate) {
      setupOptimisticUpdate(
        model,
        operation,
        schema,
        finalOptions,
        queryCache.getEntries().map((entry) => ({
          queryKey: entry.key as readonly unknown[],
          state: {
            data: entry.state.value.data,
            error: entry.state.value.error,
          },
        })),
        (queryKey, data) => {
          // update query cache
          queryCache.setQueryData(queryKey as EntryKey, data)
          // cancel on-flight queries to avoid redundant cache updates,
          // the settlement of the current mutation will trigger a new revalidation
          queryCache.cancelQueries({ key: queryKey as EntryKey })
        },
        invalidateQueries
          ? async (predicate) => {
              await queryCache.invalidateQueries({
                predicate: (entry) => predicate({ queryKey: entry.key as readonly unknown[] }),
              })
            }
          : undefined,
        logging,
      )
    }
  }

  return useMutation(finalOptions)
}

/**
 * Gets data query hooks for all models in the schema.
 */
export function useClientQueries<Schema extends SchemaDef>(schema: Schema): ClientHooks<Schema> {
  return Object.keys(schema.models).reduce((acc, model) => {
    ;(acc as Record<string, unknown>)[lowerCaseFirst(model)] = useModelQueries(schema, model as GetModels<Schema>)
    return acc
  }, {} as ClientHooks<Schema>)
}

/**
 * Gets data query hooks for a specific model in the schema.
 */
export function useModelQueries<Schema extends SchemaDef, Model extends GetModels<Schema>>(
  schema: Schema,
  model: Model,
): ModelQueryHooks<Schema, Model> {
  const modelDef = Object.values(schema.models).find((m) => m.name.toLowerCase() === model.toLowerCase())
  if (!modelDef) {
    throw new Error(`Model "${model}" not found in schema`)
  }

  const modelName = modelDef.name

  return {
    useFindUnique: (args, options?) => {
      return useInternalQuery(schema, modelName, "findUnique", args, options)
    },

    useFindFirst: (args, options?) => {
      return useInternalQuery(schema, modelName, "findFirst", args, options)
    },

    useFindMany: (args, options?) => {
      return useInternalQuery(schema, modelName, "findMany", args, options)
    },

    useInfiniteFindMany: (args, options?) => {
      return useInternalInfiniteQuery(
        schema,
        modelName,
        "findMany",
        args,
        options as Omit<UseInfiniteQueryOptions<unknown, Error>, "key" | "query" | "initialPageParam"> | undefined,
      )
    },

    useCreate: (options?) => {
      return useInternalMutation(schema, modelName, "POST", "create", options)
    },

    useCreateMany: (options?) => {
      return useInternalMutation(schema, modelName, "POST", "createMany", options)
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCreateManyAndReturn: (options?: any) => {
      return useInternalMutation(schema, modelName, "POST", "createManyAndReturn", options)
    },

    useUpdate: (options?) => {
      return useInternalMutation(schema, modelName, "PUT", "update", options)
    },

    useUpdateMany: (options?) => {
      return useInternalMutation(schema, modelName, "PUT", "updateMany", options)
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useUpdateManyAndReturn: (options?: any) => {
      return useInternalMutation(schema, modelName, "PUT", "updateManyAndReturn", options)
    },

    useUpsert: (options?) => {
      return useInternalMutation(schema, modelName, "POST", "upsert", options)
    },

    useDelete: (options?) => {
      return useInternalMutation(schema, modelName, "DELETE", "delete", options)
    },

    useDeleteMany: (options?) => {
      return useInternalMutation(schema, modelName, "DELETE", "deleteMany", options)
    },

    useCount: (args, options?) => {
      return useInternalQuery(schema, modelName, "count", args, options)
    },

    useAggregate: (args, options?) => {
      return useInternalQuery(schema, modelName, "aggregate", args, options)
    },

    useGroupBy: (args, options?) => {
      return useInternalQuery(schema, modelName, "groupBy", args, options)
    },
  } as ModelQueryHooks<Schema, Model>
}
