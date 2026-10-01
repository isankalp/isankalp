import { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { acceptBlockedTask, daysBlocked, getCarryoverQueue, rejectBlockedTask, type CarryoverItem } from '../lib/blocked'

/** Epic 81/82: resurfaces unresolved Blocked tasks from past days at the top of today's Tasks tab,
 *  with per-row and bulk Accept/Reject. Collapsing is session-only (CQ-4) — it isn't persisted, so
 *  the panel is simply shown again the next time this component mounts (e.g. the next day's visit)
 *  as long as unresolved items still exist. */
export default function BlockedItemsPanel() {
  const itemsRaw = useLiveQuery(() => getCarryoverQueue(), [])
  const loading = itemsRaw === undefined
  const items = itemsRaw ?? []
  const [collapsed, setCollapsed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmRejectIds, setConfirmRejectIds] = useState<Set<string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 animate-pulse space-y-1.5">
        <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-700" />
        <div className="h-8 rounded bg-slate-100 dark:bg-slate-700" />
      </div>
    )
  }

  if (items.length === 0) return null

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAccept(item: CarryoverItem) {
    try {
      setError(null)
      await acceptBlockedTask(item.task)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.task.id)
        return next
      })
    } catch {
      setError(`Couldn't accept "${item.task.title}" — it's still in the list, try again.`)
    }
  }

  async function handleAcceptSelected() {
    const targets = items.filter((i) => selectedIds.has(i.task.id))
    try {
      setError(null)
      await Promise.all(targets.map((i) => acceptBlockedTask(i.task)))
      setSelectedIds(new Set())
    } catch {
      setError("Couldn't accept the selected items — they're still in the list, try again.")
    }
  }

  async function handleConfirmReject() {
    if (!confirmRejectIds) return
    const targets = items.filter((i) => confirmRejectIds.has(i.task.id))
    try {
      setError(null)
      await Promise.all(targets.map((i) => rejectBlockedTask(i.task)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of confirmRejectIds) next.delete(id)
        return next
      })
      setConfirmRejectIds(null)
    } catch {
      setError("Couldn't reject the selected items — they're still in the list, try again.")
      setConfirmRejectIds(null)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10 text-xs overflow-hidden">
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 font-semibold">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="text-left"
        >
          {collapsed ? '▸' : '▾'} {items.length} Blocked Item{items.length === 1 ? '' : 's'}
        </button>
        {selectedIds.size > 0 && !collapsed && (
          <span className="flex items-center gap-1.5 font-normal">
            <button
              type="button"
              onClick={handleAcceptSelected}
              className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-medium"
            >
              Accept {selectedIds.size}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRejectIds(new Set(selectedIds))}
              className="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 text-red-600 dark:text-red-400"
            >
              Reject {selectedIds.size}
            </button>
          </span>
        )}
      </div>

      {error && <p className="px-3 pb-1.5 text-red-600 dark:text-red-400">{error}</p>}

      {!collapsed && (
        <ul className="divide-y divide-amber-200 dark:divide-amber-700">
          {items.map((item) => (
            <li key={item.task.id} className="flex items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={selectedIds.has(item.task.id)}
                onChange={() => toggleSelect(item.task.id)}
                aria-label={`Select "${item.task.title}" for bulk actions`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.task.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Blocked {daysBlocked(item.day)} day{daysBlocked(item.day) === 1 ? '' : 's'} ago
                  {item.task.blockedReason ? ` — blocked on: ${item.task.blockedReason}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAccept(item)}
                  className="px-2 py-1 rounded-md bg-indigo-600 text-white font-medium"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRejectIds(new Set([item.task.id]))}
                  className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-red-600 dark:text-red-400"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmRejectIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-800 p-4 space-y-3">
            <p className="text-sm">
              Reject {confirmRejectIds.size} item{confirmRejectIds.size === 1 ? '' : 's'}? This permanently removes{' '}
              {confirmRejectIds.size === 1 ? 'it' : 'them'} from the carryover queue and cannot be undone. The full
              history stays viewable.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRejectIds(null)}
                className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-semibold"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
