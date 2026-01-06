# ZenStack Pinia Colada

[Pinia Colada](https://pinia-colada.esm.dev/) client for [ZenStack](https://zenstack.dev) - The Smart Data Fetching Layer for Vue 3.

## Features

- 🔐 **Type-safe** - Full TypeScript support with automatic type inference
- ⚡️ **Automatic caching** - Smart caching powered by Pinia Colada
- 🔄 **Optimistic updates** - Update UI before server responds
- 🎯 **Automatic invalidation** - Cache invalidation based on data relationships
- 📦 **Zero config** - Works out of the box with your ZenStack schema
- 🌳 **Tree-shakeable** - Only bundle what you use

## Installation

```bash
npm install zenstack-pinia-colada @pinia/colada pinia
# or
pnpm add zenstack-pinia-colada @pinia/colada pinia
# or
yarn add zenstack-pinia-colada @pinia/colada pinia
```

## Prerequisites

1. You need a ZenStack project set up (v3.0.0 or higher). See [ZenStack documentation](https://zenstack.dev/docs/welcome) for details.
2. Generate your ZenStack schema using `npx zenstack generate`

**Note:** This library requires ZenStack v3 to be installed in your project. The library will use your installed version of ZenStack packages.

## Quick Start

### 1. Setup Pinia Colada

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(PiniaColada)
app.mount('#app')
```

### 2. Provide Query Settings (Optional)

```vue
<!-- App.vue or layout component -->
<script setup lang="ts">
import { provideQuerySettingsContext } from 'zenstack-pinia-colada'

provideQuerySettingsContext({
  endpoint: '/api/model', // default endpoint
  logging: true, // enable logging for debugging
})
</script>
```

### 3. Use in Components

```vue
<script setup lang="ts">
import { useClientQueries } from 'zenstack-pinia-colada'
import { schema } from './zenstack/schema-lite'

const queries = useClientQueries(schema)

// Query data
const { data: users, status, error } = queries.user.useFindMany()

// Mutations
const createUser = queries.user.useCreate()

const handleCreateUser = () => {
  createUser.mutate({
    data: {
      email: 'user@example.com',
      name: 'John Doe',
    },
  })
}
</script>

<template>
  <div>
    <div v-if="status === 'pending'">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">{{ user.name }} ({{ user.email }})</li>
    </ul>

    <button @click="handleCreateUser" :disabled="createUser.status === 'pending'">
      Create User
    </button>
  </div>
</template>
```

## API Reference

### Query Hooks

Each model in your schema gets the following query hooks:

- `useFindUnique(args, options)` - Find a unique record
- `useFindFirst(args, options)` - Find the first matching record
- `useFindMany(args, options)` - Find multiple records
- `useInfiniteFindMany(args, options)` - Paginated query with infinite loading
- `useCount(args, options)` - Count records
- `useAggregate(args, options)` - Aggregate data
- `useGroupBy(args, options)` - Group records

**Query Return Values:**

```typescript
{
  data: Ref<T | undefined>,      // Query data
  error: Ref<Error | null>,      // Error if query failed
  status: Ref<'pending' | 'success' | 'error'>,  // Query status
  refresh: () => Promise<void>,  // Manually refetch
  // ... and more from Pinia Colada
}
```

### Mutation Hooks

Each model gets these mutation hooks:

- `useCreate(options)` - Create a record
- `useCreateMany(options)` - Create multiple records
- `useCreateManyAndReturn(options)` - Create and return multiple records
- `useUpdate(options)` - Update a record
- `useUpdateMany(options)` - Update multiple records
- `useUpdateManyAndReturn(options)` - Update and return multiple records
- `useUpsert(options)` - Create or update a record
- `useDelete(options)` - Delete a record
- `useDeleteMany(options)` - Delete multiple records

**Mutation Return Values:**

```typescript
{
  mutate: (variables: T) => void,        // Trigger mutation
  mutateAsync: (variables: T) => Promise<R>,  // Async mutation
  status: Ref<'pending' | 'success' | 'error' | 'idle'>,
  data: Ref<R | undefined>,              // Mutation result
  error: Ref<Error | null>,              // Error if mutation failed
  // ... and more from Pinia Colada
}
```

## Advanced Features

### Working with Reactive Parameters

Pinia Colada automatically tracks reactive dependencies in your queries. When using reactive values (refs, computed), wrap your query arguments in a getter function:

```typescript
import { ref, computed } from 'vue'

const userId = ref('123')
const includeDeleted = ref(false)

// ✅ Correct: Use a getter function
const { data: posts } = queries.post.useFindMany(() => ({
  where: {
    authorId: userId.value,  // Unwrap refs inside the getter
    deletedAt: includeDeleted.value ? undefined : null
  },
}))

// When userId or includeDeleted changes, the query automatically re-runs!
```

**Why use a getter function?**

The getter function `() => ({...})` allows Pinia Colada to track when your reactive values change and automatically re-fetch the query. Inside the getter, unwrap refs with `.value`.

**Alternative patterns:**

```typescript
// Using computed (also works)
const queryArgs = computed(() => ({
  where: { authorId: userId.value }
}))
const { data } = queries.post.useFindMany(queryArgs)

// Static queries (no reactivity needed)
const { data } = queries.post.useFindMany({
  where: { published: true }  // No getter needed for static values
})
```

### Optimistic Updates

Optimistic updates allow the UI to update immediately before the server responds:

```typescript
const updatePost = queries.post.useUpdate({
  optimisticUpdate: true, // Enable optimistic updates
})

updatePost.mutate({
  where: { id: '1' },
  data: { title: 'New Title' },
})
// UI updates immediately, then syncs with server response
```

### Custom Query Options

Pinia Colada provides many options to customize query behavior:

```typescript
const { data } = queries.post.useFindMany(
  { where: { published: true } },
  {
    staleTime: 5000, // Consider data fresh for 5 seconds
    gcTime: 300000, // Garbage collection time (default: 5 minutes)
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: computed(() => isReady.value), // Conditionally enable
  }
)
```

### Infinite Queries (Pagination)

For paginated data with infinite scrolling:

```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = queries.post.useInfiniteFindMany(
  { take: 10, where: { published: true } },
  {
    getNextPageParam: (lastPage, pages) => {
      // Return the cursor for the next page
      return lastPage.length === 10 ? pages.length * 10 : undefined
    },
  }
)
```

### Disable Auto Invalidation

By default, mutations automatically invalidate related queries. You can disable this:

```typescript
const createPost = queries.post.useCreate({
  invalidateQueries: false, // Don't auto-invalidate related queries
})
```

## Type Safety

All hooks are fully typed based on your ZenStack schema:

```typescript
// TypeScript knows the exact shape of User
const { data: user } = queries.user.useFindUnique({
  where: { id: '1' },
  select: { id: true, name: true, email: true },
})

// user is typed as: { id: string; name: string; email: string } | null
```

## Comparison with TanStack Query

If you're familiar with `@zenstackhq/tanstack-query`, the Pinia Colada client offers:

- 🎯 **Vue-first design** - Built specifically for Vue 3 composition API
- 📦 **Smaller bundle** - Tree-shakeable ESM-only package
- 🔧 **Simpler API** - Less configuration, sensible defaults
- 🏪 **Pinia integration** - Works seamlessly with your Pinia store
- ⚡️ **Better performance** - Optimized for Vue's reactivity system

**Key API Differences:**

- Returns Vue `Ref` objects instead of plain values
- Uses `status` instead of separate `isLoading`, `isSuccess` flags
- `refresh()` instead of `refetch()` for manual updates
- Direct integration with Pinia's state management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- [ZenStack Documentation](https://zenstack.dev/docs)
- [Pinia Colada Documentation](https://pinia-colada.esm.dev/)
- [GitHub Repository](https://github.com/genu/zenstack-pinia-colada)
