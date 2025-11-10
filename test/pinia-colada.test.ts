import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientQueries } from '../src/index';
import { schema } from './schemas/basic/schema-lite';

describe('Pinia Colada Client Tests', () => {
    beforeEach(() => {
        createPinia();
        // Mock fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('useClientQueries', () => {
        it('should create hooks for all models', () => {
            const hooks = useClientQueries(schema);
            expect(hooks).toBeDefined();
            expect(hooks.user).toBeDefined();
            expect(hooks.post).toBeDefined();
            expect(hooks.category).toBeDefined();
        });

        it('should have correct query methods', () => {
            const hooks = useClientQueries(schema);
            expect(hooks.user.useFindUnique).toBeTypeOf('function');
            expect(hooks.user.useFindFirst).toBeTypeOf('function');
            expect(hooks.user.useFindMany).toBeTypeOf('function');
            expect(hooks.user.useCount).toBeTypeOf('function');
        });

        it('should have correct mutation methods', () => {
            const hooks = useClientQueries(schema);
            expect(hooks.user.useCreate).toBeTypeOf('function');
            expect(hooks.user.useUpdate).toBeTypeOf('function');
            expect(hooks.user.useDelete).toBeTypeOf('function');
            expect(hooks.user.useCreateMany).toBeTypeOf('function');
            expect(hooks.user.useUpdateMany).toBeTypeOf('function');
            expect(hooks.user.useDeleteMany).toBeTypeOf('function');
        });
    });
});
