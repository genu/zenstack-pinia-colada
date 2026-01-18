//////////////////////////////////////////////////////////////////////////////////////////////
// Typing tests for zenstack-pinia-colada                                                  //
// These tests verify TypeScript types work correctly using @ts-expect-error annotations //
//////////////////////////////////////////////////////////////////////////////////////////////

import { useClientQueries } from "../src/index"
import { schema } from "./schemas/basic/schema-lite"
import { schema as proceduresSchema } from "./schemas/procedures/schema-lite"

const client = useClientQueries(schema)
const proceduresClient = useClientQueries(proceduresSchema)

// Helper function to check types
function check(_value: unknown) {
  // noop
}

// ============================================================================
// useFindUnique
// ============================================================================

// @ts-expect-error missing args
client.user.useFindUnique()

check(client.user.useFindUnique({ where: { id: "1" } }).data.value?.email)
check(client.user.useFindUnique({ where: { id: "1" } }).queryKey)
check(client.user.useFindUnique({ where: { id: "1" } }, { optimisticUpdate: true, enabled: false }))

// @ts-expect-error unselected field
check(client.user.useFindUnique({ where: { id: "1" }, select: { email: true } }).data.value?.name)

check(client.user.useFindUnique({ where: { id: "1" }, include: { posts: true } }).data.value?.posts[0]?.title)

// ============================================================================
// useFindFirst
// ============================================================================

check(client.user.useFindFirst().data.value?.email)
check(client.user.useFindFirst().data.value?.$optimistic)

// ============================================================================
// useExists
// ============================================================================

check(client.user.useExists().data.value)
check(client.user.useExists({ where: { id: "1" } }).data.value)

// Verify useExists returns boolean
const existsResult = client.user.useExists()
const _existsValue: boolean | undefined = existsResult.data.value

// ============================================================================
// useFindMany
// ============================================================================

check(client.user.useFindMany().data.value?.[0]?.email)
check(client.user.useFindMany().data.value?.[0]?.$optimistic)

// ============================================================================
// useInfiniteFindMany
// ============================================================================

check(client.user.useInfiniteFindMany().data.value?.pages[0]?.[0]?.email)
check(
  client.user.useInfiniteFindMany(
    {},
    {
      getNextPageParam: () => ({ id: "2" }),
    },
  ).data.value?.pages[1]?.[0]?.email,
)

// ============================================================================
// useCount
// ============================================================================

check(client.user.useCount().data.value?.toFixed(2))
check(client.user.useCount({ select: { email: true } }).data.value?.email.toFixed(2))

// ============================================================================
// useAggregate
// ============================================================================

check(client.user.useAggregate({ _max: { email: true } }).data.value?._max.email)

// ============================================================================
// useGroupBy
// ============================================================================

check(client.user.useGroupBy({ by: ["email"], _max: { name: true } }).data.value?.[0]?._max.name)

// ============================================================================
// useCreate
// ============================================================================

// @ts-expect-error missing args
client.user.useCreate().mutate()
client.user.useCreate().mutate({ data: { email: "test@example.com" } })
client.user.useCreate({ optimisticUpdate: true, invalidateQueries: false }).mutate({ data: { email: "test@example.com" } })

client.user
  .useCreate()
  .mutateAsync({ data: { email: "test@example.com" }, include: { posts: true } })
  .then((d) => check(d.posts[0]?.title))

// ============================================================================
// useCreateMany
// ============================================================================

client.user
  .useCreateMany()
  .mutateAsync({
    data: [{ email: "test@example.com" }, { email: "test2@example.com" }],
    skipDuplicates: true,
  })
  .then((d) => d.count)

// ============================================================================
// useCreateManyAndReturn
// ============================================================================

client.user
  .useCreateManyAndReturn()
  .mutateAsync({
    data: [{ email: "test@example.com" }],
  })
  .then((d) => check(d[0]?.name))

client.user
  .useCreateManyAndReturn()
  .mutateAsync({
    data: [{ email: "test@example.com" }],
    select: { email: true },
  })
  // @ts-expect-error unselected field
  .then((d) => check(d[0].name))

// ============================================================================
// useUpdate
// ============================================================================

client.user.useUpdate().mutate({ data: { email: "updated@example.com" }, where: { id: "1" } })
client.user
  .useUpdate()
  .mutateAsync({ data: { email: "updated@example.com" }, where: { id: "1" } })
  .then((d) => check(d.email))

// ============================================================================
// useUpdateMany
// ============================================================================

client.user.useUpdateMany().mutate({ data: { email: "updated@example.com" } })

// ============================================================================
// useUpdateManyAndReturn
// ============================================================================

client.user
  .useUpdateManyAndReturn()
  .mutateAsync({ data: { email: "updated@example.com" } })
  .then((d) => check(d[0]?.email))

// ============================================================================
// useUpsert
// ============================================================================

client.user.useUpsert().mutate({ where: { id: "1" }, create: { email: "new@example.com" }, update: { email: "updated@example.com" } })

// ============================================================================
// useDelete
// ============================================================================

client.user.useDelete().mutate({ where: { id: "1" }, include: { posts: true } })

// ============================================================================
// useDeleteMany
// ============================================================================

client.user.useDeleteMany().mutate({ where: { email: "test@example.com" } })

// ============================================================================
// Delegate model operations
// ============================================================================

// @ts-expect-error delegate model - useCreate is ineligible
client.foo.useCreate()

client.foo.useUpdate()
client.bar.useCreate()

// ============================================================================
// Custom Procedures - Query
// ============================================================================

check(proceduresClient.$procs.greet.useQuery().data.value?.toUpperCase())
check(proceduresClient.$procs.greet.useQuery({ args: { name: "bob" } }).data.value?.toUpperCase())
check(proceduresClient.$procs.greet.useQuery({ args: { name: "bob" } }).queryKey())

// @ts-expect-error greet is not a mutation procedure
proceduresClient.$procs.greet.useMutation()

// ============================================================================
// Custom Procedures - Mutation
// ============================================================================

proceduresClient.$procs.sum.useMutation().mutate({ args: { a: 1, b: 2 } })
// @ts-expect-error wrong arg shape for multi-param procedure
proceduresClient.$procs.sum.useMutation().mutate([1, 2])
proceduresClient.$procs.sum
  .useMutation()
  .mutateAsync({ args: { a: 1, b: 2 } })
  .then((d) => check(d.toFixed(2)))

// Test that useQuery does NOT exist on mutation procedures
// If this compiles without error, useQuery incorrectly exists on sum
type SumHooks = (typeof proceduresClient.$procs)["sum"]
// @ts-expect-error useQuery should not be a property of mutation procedures
type SumUseQuery = SumHooks["useQuery"]
