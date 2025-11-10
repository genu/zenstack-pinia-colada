# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Pinia Colada client library for ZenStack v3, providing type-safe data fetching hooks for Vue 3 applications. It bridges ZenStack's CRUD APIs with Pinia Colada's smart caching layer.

**Tech Stack:**
- Vue 3 + Pinia + Pinia Colada
- TypeScript (ESM-only)
- ZenStack for backend ORM/access control
- Built with tsdown (bundler)

## Development Commands

### Build
```bash
pnpm run build          # Build the library
pnpm run watch          # Build in watch mode
```

### Testing
```bash
pnpm test               # Run all tests
pnpm test:generate      # Generate test schema from ZenStack
pnpm test:typecheck     # Type-check test files only
```

### Code Quality
```bash
pnpm run lint           # Lint source files
pnpm run changelog      # Generate changelog
```

### Publishing
```bash
pnpm run release        # Generate changelog + publish to npm
pnpm run release:push-tags  # Push git tags after release
```

## Architecture

### Core Concepts

**Hook Factories (`useClientQueries`, `useModelQueries`):**
- Located in `src/index.ts`
- Generate type-safe hooks for each model in the ZenStack schema
- Return query hooks (useFindMany, useFindUnique, etc.) and mutation hooks (useCreate, useUpdate, etc.)

**Internal Implementations:**
- `useInternalQuery`: Wraps Pinia Colada's `useQuery` with ZenStack-specific logic
- `useInternalInfiniteQuery`: Handles paginated queries
- `useInternalMutation`: Wraps Pinia Colada's `useMutation` with automatic cache invalidation

**Pinia Colada API Changes from TanStack Query:**
- `queryKey` → `key`
- `queryFn` → `query` (receives `{ signal }` for regular queries, `{ signal, nextPage }` for infinite)
- `mutationFn` → `mutation`
- Query cache access: `useQueryCache()` instead of `useQueryClient()`

### Key Utilities (`src/utils/`)

**`common.ts`:**
- HTTP fetching, query key generation, URL building
- `setupOptimisticUpdate`: Automatically updates cache before mutations complete
- `setupInvalidation`: Automatically invalidates related queries after mutations
- Uses Pinia Colada's cache API: `getEntries()`, `setQueryData()`, `invalidateQueries()`, `cancelQueries()`

**`query-analysis.ts`:**
- `getReadModels`: Analyzes which models a query reads from (handles include/select)
- `getMutatedModels`: Determines which models are affected by a mutation
- Critical for automatic cache invalidation

**`mutator.ts` / `nested-*-visitor.ts`:**
- Client-side mutation logic for optimistic updates
- Applies mutations to cached data using visitor pattern
- Handles nested creates, updates, and relations

**`serialization.ts`:**
- SuperJSON-based serialization for Prisma types
- Custom serializers for `Decimal` (decimal.js) and `Uint8Array` (Prisma Bytes)
- Uses browser-native `btoa`/`atob` (no Node.js Buffer dependency)

### Cache Key Structure

Query keys follow the pattern:
```typescript
['zenstack', modelName, operation, args]
```

Example: `['zenstack', 'user', 'findMany', { where: { ... } }]`

### Context Injection

Users can optionally provide query settings via Vue's provide/inject:
```typescript
provideQuerySettingsContext({
  endpoint: '/api/model',  // API endpoint
  fetch: customFetch,       // Custom fetch function
  logging: true             // Enable debug logging
})
```

## Important Patterns

### Type Safety with Wrapper Functions

The wrapper functions in `useModelQueries` use `any` types intentionally - the actual type safety comes from the `ModelQueryHooks<Schema, Model>` cast at the end. This avoids duplicating complex generic types while maintaining full type inference for users.

### Optimistic Updates Flow

1. User calls mutation with `optimisticUpdate: true`
2. `setupOptimisticUpdate` hooks into `onMutate`
3. Reads all cache entries via `queryCache.getEntries()`
4. Uses `query-analysis` to find affected queries
5. Applies mutation to cached data via `mutator`
6. Updates cache via `queryCache.setQueryData()`
7. On mutation settle, invalidates queries to refetch

### Cache Entry Mapping

Pinia Colada entries have a different structure than TanStack Query:
- Property is `entry.key` (not `queryKey`)
- State is `entry.state.value.data` (reactive ref that needs `.value`)
- Predicate filtering requires wrapping to adapt the structure

## Testing

Test schemas are in `test/schemas/` as `.zmodel` files. The `scripts/generate.ts` script uses `@zenstackhq/language` and `@zenstackhq/sdk` to generate TypeScript schema definitions for tests.

## Build Output

The library builds to ESM-only format:
- `dist/index.mjs` - Main bundle
- `dist/index.d.mts` - TypeScript declarations
- Source maps for both

Package exports point directly to these files via `exports` field in package.json.
