# ZenStack Pinia Colada

Pinia Colada client for [ZenStack](https://zenstack.dev) - The Smart Data Fetching Layer for Vue 3.

## What is ZenStack?

ZenStack is a toolkit that supercharges Prisma ORM with a powerful access control layer and unleashes its full potential for full-stack development. It allows you to write authorization logic in your database schema and generates type-safe CRUD APIs automatically.

## What is Pinia Colada?

[Pinia Colada](https://pinia-colada.esm.dev/) is the smart data fetching layer for Vue 3, built on top of Pinia. It provides declarative data fetching with automatic caching, request deduplication, and optimistic updates.

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

1. You need a ZenStack project set up. See [ZenStack documentation](https://zenstack.dev/docs/welcome) for details.
2. Generate your ZenStack schema using `npx zenstack generate`

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

```typescript
// App.vue or layout component
<script setup lang="ts">
import { provideQuerySettingsContext } from 'zenstack-pinia-colada/vue'

provideQuerySettingsContext({
  endpoint: '/api/model', // default endpoint
  logging: true, // enable logging for debugging
})
</script>
```

### 3. Use in Components

```vue
<script setup lang="ts">
import { useClientQueries } from 'zenstack-pinia-colada/vue'
import { schema } from './zenstack/schema-lite'

const queries = useClientQueries(schema)

// Query data
const { data: users, isPending, error } = queries.user.useFindMany()

// Mutations
const createUser = queries.user.useCreate()

const handleCreateUser = () => {
  createUser.mutate({
    data: {
      email: 'user@example.com',
      name: 'John Doe'
    }
  })
}
</script>

<template>
  <div>
    <div v-if="isPending">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">
        {{ user.name }} ({{ user.email }})
      </li>
    </ul>

    <button @click="handleCreateUser">Create User</button>
  </div>
</template>
```

## API Reference

### Query Hooks

Each model in your schema gets the following query hooks:

- `useFindUnique(args, options)` - Find a unique record
- `useFindFirst(args, options)` - Find the first matching record
- `useFindMany(args, options)` - Find multiple records
- `useCount(args, options)` - Count records
- `useAggregate(args, options)` - Aggregate data
- `useGroupBy(args, options)` - Group records

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

## Advanced Features

### Optimistic Updates

```typescript
const updatePost = queries.post.useUpdate({
  optimisticUpdate: true, // Enable optimistic updates
})

updatePost.mutate({
  where: { id: '1' },
  data: { title: 'New Title' }
})
```

### Custom Query Options

```typescript
const { data } = queries.post.useFindMany(
  { where: { published: true } },
  {
    staleTime: 5000, // Consider data fresh for 5 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  }
)
```

### Disable Auto Invalidation

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
  select: { id: true, name: true, email: true }
})

// user is typed as: { id: string; name: string; email: string } | null
```

## Comparison with TanStack Query

If you're familiar with `@zenstackhq/tanstack-query`, the Pinia Colada client offers:

- 🎯 **Vue-first design** - Built specifically for Vue 3 composition API
- 📦 **Smaller bundle** - Tree-shakeable with minimal dependencies
- 🔧 **Simpler API** - Less configuration needed
- 🏪 **Pinia integration** - Works seamlessly with your Pinia store

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- [ZenStack Documentation](https://zenstack.dev/docs)
- [Pinia Colada Documentation](https://pinia-colada.esm.dev/)
- [GitHub Repository](https://github.com/zenstackhq/zenstack-pinia-colada)
