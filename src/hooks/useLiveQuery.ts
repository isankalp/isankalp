import { useEffect, useState } from 'react'
import { onDbChange } from '../db/dbEvents'

/**
 * Drop-in replacement for dexie-react-hooks' `useLiveQuery`, re-running `querier` whenever `deps`
 * change or the data layer reports a write — from either backend (local Dexie or cloud Supabase),
 * including the moment login/logout switches which one is active. Coarser-grained than Dexie's own
 * per-table dependency tracking (any write anywhere triggers a re-run of every mounted query), which
 * trades a few extra re-executions for one reactivity mechanism that works identically across both
 * backends.
 */
export function useLiveQuery<T>(querier: () => T | Promise<T>, deps: unknown[] = []): T | undefined {
  const [result, setResult] = useState<T | undefined>(undefined)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.resolve(querier()).then((value) => {
      if (!cancelled) setResult(value)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is caller-supplied, mirroring dexie-react-hooks' API
  }, [...deps, generation])

  useEffect(() => onDbChange(() => setGeneration((g) => g + 1)), [])

  return result
}
