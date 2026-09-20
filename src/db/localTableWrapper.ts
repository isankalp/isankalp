import type { Table } from 'dexie'
import { emitDbChange } from './dbEvents'

const MUTATING_METHODS = new Set(['add', 'put', 'update', 'delete', 'bulkAdd', 'bulkPut', 'bulkDelete', 'clear'])

/**
 * Wraps a real Dexie Table so every mutation also fires the shared dbEvents change signal —
 * the same mechanism the cloud backend uses — so `useLiveQuery` works identically for both without
 * depending on Dexie's own (separate) reactivity system. Read-only methods (where/orderBy/filter/get/
 * count/toCollection) pass straight through untouched.
 */
export function wrapLocalTable<T, K>(table: Table<T, K>): Table<T, K> {
  return new Proxy(table, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      if (typeof prop === 'string' && MUTATING_METHODS.has(prop)) {
        return async (...args: unknown[]) => {
          const result = await (value as (...a: unknown[]) => unknown).apply(target, args)
          emitDbChange()
          return result
        }
      }
      return value.bind(target)
    },
  }) as Table<T, K>
}
