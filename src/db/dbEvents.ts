/**
 * A single change signal for the whole data layer, used by both the local (Dexie) and cloud
 * (Supabase) backends so `useLiveQuery` can react to writes uniformly regardless of which one is
 * active — including the moment the app switches between them on login/logout.
 */
type Listener = () => void

const listeners = new Set<Listener>()

export function emitDbChange(): void {
  for (const listener of listeners) listener()
}

export function onDbChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
