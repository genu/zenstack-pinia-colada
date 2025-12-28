import type { QueryCache, UseQueryEntry } from '@pinia/colada';
import type { InvalidationPredicate, QueryInfo } from '@zenstackhq/client-helpers';
import { parseQueryKey } from './query-key';

export function invalidateQueriesMatchingPredicate(queryCache: QueryCache, predicate: InvalidationPredicate) {
    return queryCache.invalidateQueries({
        predicate: (entry: UseQueryEntry) => {
            const parsed = parseQueryKey(entry.key as readonly unknown[]);
            if (!parsed) {
                return false;
            }
            return predicate({ model: parsed.model as string, args: parsed.args });
        },
    });
}

export function getAllQueries(queryCache: QueryCache): readonly QueryInfo[] {
    return queryCache
        .getEntries()
        .map((entry: UseQueryEntry) => {
            const parsed = parseQueryKey(entry.key as readonly unknown[]);
            if (!parsed) {
                return undefined;
            }
            return {
                model: parsed?.model,
                operation: parsed?.operation,
                args: parsed?.args,
                data: entry.state.value.data,
                optimisticUpdate: !!parsed.flags.optimisticUpdate,
                updateData: (data: unknown, cancelOnTheFlyQueries: boolean) => {
                    queryCache.setQueryData(entry.key, data);
                    if (cancelOnTheFlyQueries) {
                        queryCache.cancelQueries({ key: entry.key });
                    }
                },
            };
        })
        .filter((entry): entry is QueryInfo => !!entry);
}
