import type { GetModels, SchemaDef } from "@zenstackhq/schema"
import type {
  AggregateArgs,
  AggregateResult,
  BatchResult,
  CountArgs,
  CountResult,
  CreateArgs,
  CreateManyAndReturnArgs,
  CreateManyArgs,
  DeleteArgs,
  DeleteManyArgs,
  ExistsArgs,
  FindFirstArgs,
  FindManyArgs,
  FindUniqueArgs,
  GetProcedure,
  GetProcedureNames,
  GroupByArgs,
  GroupByResult,
  ProcedureEnvelope,
  QueryOptions,
  SelectSubset,
  SimplifiedPlainResult,
  SimplifiedResult,
  Subset,
  UpdateArgs,
  UpdateManyAndReturnArgs,
  UpdateManyArgs,
  UpsertArgs,
} from "@zenstackhq/orm"
import { computed, inject, provide, toValue, unref, type MaybeRefOrGetter, type UnwrapRef } from "vue"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryCache,
  type EntryKey,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturn,
  type UseMutationOptions,
  type UseMutationReturn,
  type UseQueryOptions,
  type UseQueryReturn,
} from "@pinia/colada"
import { lowerCaseFirst } from "@zenstackhq/common-helpers"
import {
  createInvalidator,
  createOptimisticUpdater,
  DEFAULT_QUERY_ENDPOINT,
  type InvalidationPredicate,
} from "@zenstackhq/client-helpers"
import { fetcher, makeUrl, marshal } from "@zenstackhq/client-helpers/fetch"
import { getAllQueries, invalidateQueriesMatchingPredicate } from "./common/client"
import { CUSTOM_PROC_ROUTE_NAME } from "./common/constants"
import { getQueryKey } from "./common/query-key"
import type {
  ExtraMutationOptions,
  ExtraQueryOptions,
  ProcedureReturn,
  QueryContext,
  TrimDelegateModelOperations,
  WithOptimistic,
} from "./common/types"

export type { FetchFn } from "@zenstackhq/client-helpers/fetch"
export type { SchemaDef } from "@zenstackhq/schema"
export const PiniaColadaContextKey = "zenstack-pinia-colada-context"

/**
 * Provide context for query settings.
 *
 * @deprecated Use {@link provideQuerySettingsContext} instead.
 */
export function provideHooksContext(context: QueryContext) {
  provide<QueryContext>(PiniaColadaContextKey, context)
}

/**
 * Provide context for query settings.
 */
export function provideQuerySettingsContext(context: QueryContext) {
  provide<QueryContext>(PiniaColadaContextKey, context)
}

function useQuerySettings() {
  const { endpoint, ...rest } = inject<QueryContext>(PiniaColadaContextKey, {
    endpoint: DEFAULT_QUERY_ENDPOINT,
    fetch: undefined,
    logging: false,
  })
  return { endpoint: endpoint ?? DEFAULT_QUERY_ENDPOINT, ...rest }
}

export type ModelQueryOptions<T> = MaybeRefOrGetter<Omit<UnwrapRef<UseQueryOptions<T>>, "key" | "query"> & ExtraQueryOptions>

export type ModelQueryResult<T> = UseQueryReturn<WithOptimistic<T>, Error> & { queryKey: () => EntryKey }

export type ModelInfiniteQueryOptions<T> = MaybeRefOrGetter<
  Omit<UnwrapRef<UseInfiniteQueryOptions<T, Error, any, undefined>>, "key" | "initialPageParam" | "query"> & QueryContext
>

export type ModelInfiniteQueryResult<T> = UseInfiniteQueryReturn<T, Error> & { queryKey: () => EntryKey }

export type ModelMutationOptions<T, TArgs> = MaybeRefOrGetter<
  Omit<UnwrapRef<UseMutationOptions<T, TArgs>>, "mutation"> & ExtraMutationOptions
>

export type ModelMutationResult<T, TArgs> = UseMutationReturn<T, TArgs, Error>

export type ModelMutationModelResult<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  TArgs,
  Array extends boolean = false,
  Options extends QueryOptions<Schema> = QueryOptions<Schema>,
> = Omit<ModelMutationResult<SimplifiedResult<Schema, Model, TArgs, QueryOptions<Schema>, false, Array>, TArgs>, "mutateAsync"> & {
  mutateAsync<T extends TArgs>(
    args: T,
    options?: ModelMutationOptions<SimplifiedResult<Schema, Model, T, Options, false, Array>, T>,
  ): Promise<SimplifiedResult<Schema, Model, T, Options, false, Array>>
}

type ProcedureHookFn<
  Schema extends SchemaDef,
  ProcName extends GetProcedureNames<Schema>,
  Options,
  Result,
  Input = ProcedureEnvelope<Schema, ProcName>,
> = { args: undefined } extends Input
  ? (args?: MaybeRefOrGetter<Input>, options?: MaybeRefOrGetter<Options>) => Result
  : (args: MaybeRefOrGetter<Input>, options?: MaybeRefOrGetter<Options>) => Result

type ProcedureHookGroup<Schema extends SchemaDef> = {
  [Name in GetProcedureNames<Schema>]: GetProcedure<Schema, Name> extends { mutation: true }
    ? {
        useMutation(
          options?: MaybeRefOrGetter<Omit<UnwrapRef<UseMutationOptions<ProcedureReturn<Schema, Name>, ProcedureEnvelope<Schema, Name>>>, "mutation"> & QueryContext>,
        ): UseMutationReturn<ProcedureReturn<Schema, Name>, ProcedureEnvelope<Schema, Name>, Error>
      }
    : {
        useQuery: ProcedureHookFn<
          Schema,
          Name,
          Omit<ModelQueryOptions<ProcedureReturn<Schema, Name>>, "optimisticUpdate">,
          UseQueryReturn<ProcedureReturn<Schema, Name>, Error> & { queryKey: () => EntryKey }
        >
      }
}

export type ProcedureHooks<Schema extends SchemaDef> = Schema extends { procedures: Record<string, any> }
  ? {
      /**
       * Custom procedures.
       */
      $procs: ProcedureHookGroup<Schema>
    }
  : {}

export type ClientHooks<Schema extends SchemaDef, Options extends QueryOptions<Schema> = QueryOptions<Schema>> = {
  [Model in GetModels<Schema> as `${Uncapitalize<Model>}`]: ModelQueryHooks<Schema, Model, Options>
} & ProcedureHooks<Schema>

// Note that we can potentially use TypeScript's mapped type to directly map from ORM contract, but that seems
// to significantly slow down tsc performance ...
export type ModelQueryHooks<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  Options extends QueryOptions<Schema> = QueryOptions<Schema>,
> = TrimDelegateModelOperations<
  Schema,
  Model,
  {
    useFindUnique<T extends FindUniqueArgs<Schema, Model>>(
      args: MaybeRefOrGetter<SelectSubset<T, FindUniqueArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<SimplifiedPlainResult<Schema, Model, T, Options> | null>>,
    ): ModelQueryResult<SimplifiedPlainResult<Schema, Model, T, Options> | null>

    useFindFirst<T extends FindFirstArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindFirstArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<SimplifiedPlainResult<Schema, Model, T, Options> | null>>,
    ): ModelQueryResult<SimplifiedPlainResult<Schema, Model, T, Options> | null>

    useExists<T extends ExistsArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<Subset<T, ExistsArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<boolean>>,
    ): ModelQueryResult<boolean>

    useFindMany<T extends FindManyArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindManyArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<SimplifiedPlainResult<Schema, Model, T, Options>[]>>,
    ): ModelQueryResult<SimplifiedPlainResult<Schema, Model, T, Options>[]>

    useInfiniteFindMany<T extends FindManyArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<SelectSubset<T, FindManyArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelInfiniteQueryOptions<SimplifiedPlainResult<Schema, Model, T, Options>[]>>,
    ): ModelInfiniteQueryResult<SimplifiedPlainResult<Schema, Model, T, Options>[]>

    useCreate<T extends CreateArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<SimplifiedPlainResult<Schema, Model, T, Options>, T>>,
    ): ModelMutationModelResult<Schema, Model, T, false, Options>

    useCreateMany<T extends CreateManyArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<BatchResult, T>>,
    ): ModelMutationResult<BatchResult, T>

    useCreateManyAndReturn<T extends CreateManyAndReturnArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<SimplifiedPlainResult<Schema, Model, T, Options>[], T>>,
    ): ModelMutationModelResult<Schema, Model, T, true, Options>

    useUpdate<T extends UpdateArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<SimplifiedPlainResult<Schema, Model, T, Options>, T>>,
    ): ModelMutationModelResult<Schema, Model, T, false, Options>

    useUpdateMany<T extends UpdateManyArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<BatchResult, T>>,
    ): ModelMutationResult<BatchResult, T>

    useUpdateManyAndReturn<T extends UpdateManyAndReturnArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<SimplifiedPlainResult<Schema, Model, T, Options>[], T>>,
    ): ModelMutationModelResult<Schema, Model, T, true, Options>

    useUpsert<T extends UpsertArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<SimplifiedPlainResult<Schema, Model, T, Options>, T>>,
    ): ModelMutationModelResult<Schema, Model, T, false, Options>

    useDelete<T extends DeleteArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<SimplifiedPlainResult<Schema, Model, T, Options>, T>>,
    ): ModelMutationModelResult<Schema, Model, T, false, Options>

    useDeleteMany<T extends DeleteManyArgs<Schema, Model>>(
      options?: MaybeRefOrGetter<ModelMutationOptions<BatchResult, T>>,
    ): ModelMutationResult<BatchResult, T>

    useCount<T extends CountArgs<Schema, Model>>(
      args?: MaybeRefOrGetter<Subset<T, CountArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<CountResult<Schema, Model, T>>>,
    ): ModelQueryResult<CountResult<Schema, Model, T>>

    useAggregate<T extends AggregateArgs<Schema, Model>>(
      args: MaybeRefOrGetter<Subset<T, AggregateArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<AggregateResult<Schema, Model, T>>>,
    ): ModelQueryResult<AggregateResult<Schema, Model, T>>

    useGroupBy<T extends GroupByArgs<Schema, Model>>(
      args: MaybeRefOrGetter<Subset<T, GroupByArgs<Schema, Model>>>,
      options?: MaybeRefOrGetter<ModelQueryOptions<GroupByResult<Schema, Model, T>>>,
    ): ModelQueryResult<GroupByResult<Schema, Model, T>>
  }
>

/**
 * Gets data query hooks for all models in the schema.
 */
export function useClientQueries<Schema extends SchemaDef, Options extends QueryOptions<Schema> = QueryOptions<Schema>>(
  schema: Schema,
  options?: MaybeRefOrGetter<QueryContext>,
): ClientHooks<Schema, Options> {
  const merge = (rootOpt: MaybeRefOrGetter<unknown> | undefined, opt: MaybeRefOrGetter<unknown> | undefined): any => {
    return computed(() => {
      const rootVal = toValue(rootOpt) ?? {}
      const optVal = toValue(opt) ?? {}
      return { ...(rootVal as object), ...(optVal as object) }
    })
  }

  const mergeMutation = (rootOpt: MaybeRefOrGetter<unknown> | undefined, opt: MaybeRefOrGetter<unknown> | undefined): any => {
    return { ...(toValue(rootOpt) as object), ...(toValue(opt) as object) }
  }

  const result = Object.keys(schema.models).reduce(
    (acc, model) => {
      ;(acc as any)[lowerCaseFirst(model)] = useModelQueries<Schema, GetModels<Schema>, Options>(
        schema,
        model as GetModels<Schema>,
        options,
      )
      return acc
    },
    {} as ClientHooks<Schema, Options>,
  )

  const procedures = (schema as any).procedures as Record<string, { mutation?: boolean }> | undefined
  if (procedures) {
    const buildProcedureHooks = () => {
      return Object.keys(procedures).reduce((acc, name) => {
        const procDef = procedures[name]
        if (procDef?.mutation) {
          acc[name] = {
            useMutation: (hookOptions?: any) =>
              useInternalMutation(schema, CUSTOM_PROC_ROUTE_NAME, "POST", name, mergeMutation(options, hookOptions)),
          }
        } else {
          acc[name] = {
            useQuery: (args?: any, hookOptions?: any) =>
              useInternalQuery(schema, CUSTOM_PROC_ROUTE_NAME, name, args, merge(options, hookOptions)),
          }
        }
        return acc
      }, {} as any)
    }

    ;(result as any).$procs = buildProcedureHooks()
  }

  return result
}

/**
 * Gets data query hooks for a specific model in the schema.
 */
export function useModelQueries<Schema extends SchemaDef, Model extends GetModels<Schema>, Options extends QueryOptions<Schema>>(
  schema: Schema,
  model: Model,
  rootOptions?: MaybeRefOrGetter<QueryContext>,
): ModelQueryHooks<Schema, Model, Options> {
  const modelDef = Object.values(schema.models).find((m) => m.name.toLowerCase() === model.toLowerCase())
  if (!modelDef) {
    throw new Error(`Model "${model}" not found in schema`)
  }

  const modelName = modelDef.name

  const merge = (rootOpt: MaybeRefOrGetter<unknown> | undefined, opt: MaybeRefOrGetter<unknown> | undefined): any => {
    return computed(() => {
      return { ...(toValue(rootOpt) as object), ...(toValue(opt) as object) }
    })
  }

  const mergeMutation = (rootOpt: MaybeRefOrGetter<unknown> | undefined, opt: MaybeRefOrGetter<unknown> | undefined): any => {
    return { ...(toValue(rootOpt) as object), ...(toValue(opt) as object) }
  }

  return {
    useFindUnique: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "findUnique", args, merge(rootOptions, options))
    },

    useFindFirst: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "findFirst", args, merge(rootOptions, options))
    },

    useExists: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "exists", args, merge(rootOptions, options))
    },

    useFindMany: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "findMany", args, merge(rootOptions, options))
    },

    useInfiniteFindMany: (args: any, options?: any) => {
      return useInternalInfiniteQuery(schema, modelName, "findMany", args, merge(rootOptions, options))
    },

    useCreate: (options?: any) => {
      return useInternalMutation(schema, modelName, "POST", "create", mergeMutation(rootOptions, options))
    },

    useCreateMany: (options?: any) => {
      return useInternalMutation(schema, modelName, "POST", "createMany", mergeMutation(rootOptions, options))
    },

    useCreateManyAndReturn: (options?: any) => {
      return useInternalMutation(schema, modelName, "POST", "createManyAndReturn", mergeMutation(rootOptions, options))
    },

    useUpdate: (options?: any) => {
      return useInternalMutation(schema, modelName, "PUT", "update", mergeMutation(rootOptions, options))
    },

    useUpdateMany: (options?: any) => {
      return useInternalMutation(schema, modelName, "PUT", "updateMany", mergeMutation(rootOptions, options))
    },

    useUpdateManyAndReturn: (options?: any) => {
      return useInternalMutation(schema, modelName, "PUT", "updateManyAndReturn", mergeMutation(rootOptions, options))
    },

    useUpsert: (options?: any) => {
      return useInternalMutation(schema, modelName, "POST", "upsert", mergeMutation(rootOptions, options))
    },

    useDelete: (options?: any) => {
      return useInternalMutation(schema, modelName, "DELETE", "delete", mergeMutation(rootOptions, options))
    },

    useDeleteMany: (options?: any) => {
      return useInternalMutation(schema, modelName, "DELETE", "deleteMany", mergeMutation(rootOptions, options))
    },

    useCount: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "count", args, merge(rootOptions, options))
    },

    useAggregate: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "aggregate", args, merge(rootOptions, options))
    },

    useGroupBy: (args: any, options?: any) => {
      return useInternalQuery(schema, modelName, "groupBy", args, merge(rootOptions, options))
    },
  } as ModelQueryHooks<Schema, Model, Options>
}

export function useInternalQuery<TQueryFnData>(
  _schema: SchemaDef,
  model: string,
  operation: string,
  args?: MaybeRefOrGetter<unknown>,
  options?: MaybeRefOrGetter<Omit<UnwrapRef<UseQueryOptions<TQueryFnData, Error>>, "key"> & ExtraQueryOptions>,
) {
  const { endpoint, fetch } = useFetchOptions(options)

  // reactive query key function
  const queryKey = () => {
    const argsValue = toValue(args)
    const { optimisticUpdate } = toValue(options) ?? {}
    return getQueryKey(model, operation, argsValue, {
      infinite: false,
      optimisticUpdate: optimisticUpdate !== false,
    })
  }

  // reactive query options
  const finalOptions: any = computed(() => {
    const { optimisticUpdate: _, ...restOptions } = toValue(options) ?? {}
    return {
      key: queryKey,
      query: ({ signal }: any) => {
        const reqUrl = makeUrl(endpoint, model, operation, toValue(args))
        return fetcher<TQueryFnData>(reqUrl, { signal }, fetch)
      },
      ...restOptions,
    }
  })
  return { queryKey, ...useQuery<TQueryFnData, Error>(finalOptions) }
}

export function useInternalInfiniteQuery<TQueryFnData>(
  _schema: SchemaDef,
  model: string,
  operation: string,
  args: MaybeRefOrGetter<unknown>,
  options: MaybeRefOrGetter<
    Omit<UnwrapRef<UseInfiniteQueryOptions<TQueryFnData, Error, any, undefined>>, "key" | "initialPageParam"> & QueryContext
  >,
) {
  options = options ?? { getNextPageParam: () => undefined }

  const { endpoint, fetch } = useFetchOptions(options)

  // reactive query key function
  const queryKey = () => {
    const argsValue = toValue(args)
    return getQueryKey(model, operation, argsValue, { infinite: true, optimisticUpdate: false })
  }

  const finalOptions: any = computed(() => {
    const argsValue = toValue(args)
    const optionsValue = toValue(options)

    return {
      key: queryKey,
      initialPageParam: toValue(argsValue),
      ...optionsValue,
      query: ({ signal }: any) => {
        const reqUrl = makeUrl(endpoint, model, operation, argsValue)
        return fetcher<TQueryFnData>(reqUrl, { signal }, fetch)
      },
    }
  })

  return {
    queryKey,
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
 * @param options The Pinia Colada options.
 * @param checkReadBack Whether to check for read back errors and return undefined if found.
 */
export function useInternalMutation<TArgs, R = any>(
  schema: SchemaDef,
  model: string,
  method: "POST" | "PUT" | "DELETE",
  operation: string,
  options?: MaybeRefOrGetter<Omit<UnwrapRef<UseMutationOptions<R, TArgs>>, "mutation"> & ExtraMutationOptions>,
) {
  const queryCache = useQueryCache()

  const { endpoint, fetch, logging } = useFetchOptions(options)
  const mutationFn = (data: any) => {
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

  // build mutation options
  const optionsValue = toValue(options)
  const result = {
    ...optionsValue,
    mutation: mutationFn,
  } as UnwrapRef<UseMutationOptions<R, TArgs>> & ExtraMutationOptions

  if (model !== CUSTOM_PROC_ROUTE_NAME) {
    // not a custom procedure, set up optimistic update and invalidation
    const invalidateQueries = optionsValue?.invalidateQueries !== false
    const optimisticUpdate = !!optionsValue?.optimisticUpdate

    if (!optimisticUpdate) {
      if (invalidateQueries) {
        const invalidator = createInvalidator(
          model,
          operation,
          schema,
          (predicate: InvalidationPredicate) => {
            invalidateQueriesMatchingPredicate(queryCache, predicate)
          },
          logging,
        )
        // execute invalidator prior to user-provided onSuccess
        result.onSuccess = async (...args) => {
          await invalidator(...args)
          const origOnSuccess: any = toValue(optionsValue?.onSuccess)
          await origOnSuccess?.(...args)
        }
      }
    } else {
      const optimisticUpdater = createOptimisticUpdater(
        model,
        operation,
        schema,
        { optimisticDataProvider: result.optimisticDataProvider },
        () => getAllQueries(queryCache),
        logging,
      )

      // optimistic update on mutate
      const origOnMutate = result.onMutate
      result.onMutate = async (...args) => {
        // execute optimistic updater prior to user-provided onMutate
        await optimisticUpdater(...args)

        // call user-provided onMutate
        return unref(origOnMutate)?.(...args)
      }

      if (invalidateQueries) {
        const invalidator = createInvalidator(
          model,
          operation,
          schema,
          (predicate: InvalidationPredicate) => {
            invalidateQueriesMatchingPredicate(queryCache, predicate)
          },
          logging,
        )
        const origOnSettled = result.onSettled
        result.onSettled = async (...args) => {
          // execute invalidator prior to user-provided onSettled
          await invalidator(...args)

          // call user-provided onSettled
          return unref(origOnSettled)?.(...args)
        }
      }
    }
  }

  return useMutation(result as any)
}

function useFetchOptions(options: MaybeRefOrGetter<QueryContext | undefined>) {
  const { endpoint, fetch, logging } = useQuerySettings()
  const optionsValue = toValue(options)
  // options take precedence over context
  return {
    endpoint: optionsValue?.endpoint ?? endpoint,
    fetch: optionsValue?.fetch ?? fetch,
    logging: optionsValue?.logging ?? logging,
  }
}
