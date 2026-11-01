import { useEffect, useState } from 'react'
import { db, getOrCreateDay } from '../db/db'
import type { Day, Task } from '../db/models'
import { canSaveDeadline, computeDeadlineBarState, formatCountdown } from '../lib/deadline'
import { todayKey } from '../lib/date'

interface Props {
  /** The date this bar is for. `day` may still be undefined if no Day row has been created for it
   *  yet (e.g. a future day never visited before, DL-4) — Save/Remove create it on demand. */
  date: string
  day: Day | undefined
  tasks: Task[]
}

const URGENCY_STYLE: Record<'active' | 'warning' | 'critical', string> = {
  active: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
  warning: 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-500/10',
  critical: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-500/10',
}

const URGENCY_ICON: Record<'active' | 'warning' | 'critical', string> = {
  active: '⏱',
  warning: '⚠️',
  critical: '🔥',
}

/** Epics 83-85: "Set Deadline" entry point above the carryover panel (BlockedItemsPanel) on the
 *  Tasks tab, per the UI spec. DL-2/CT-8: renders nothing but a skeleton/button when day.deadlineTime
 *  is absent — there is no timer-ish UI at all in that case. Works for today (live countdown) and a
 *  future day (DL-4: the time can be pre-set, just without a ticking display yet). */
export default function DeadlineBar({ date, day, tasks }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  const [draftTime, setDraftTime] = useState(day?.deadlineTime ?? '18:00')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const state = computeDeadlineBarState(day ?? { date }, tasks, now)
  const isToday = date === todayKey()

  useEffect(() => {
    if (!isToday) return
    if (state.kind === 'empty' || state.kind === 'expired') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, state.kind, day?.deadlineTime])

  function openEditor() {
    setDraftTime(day?.deadlineTime ?? '18:00')
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    if (!canSaveDeadline(date, draftTime, now)) {
      setError(
        isToday ? "That time has already passed — pick a time later than now." : "Couldn't save that deadline.",
      )
      return
    }
    setSaving(true)
    try {
      const resolved = await getOrCreateDay(date)
      await db.days.update(resolved.id, { deadlineTime: draftTime, deadlineOutcome: undefined })
      setError(null)
      setEditing(false)
    } catch {
      setError("Couldn't save the deadline — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!day) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await db.days.update(day.id, { deadlineTime: undefined, deadlineOutcome: undefined })
      setEditing(false)
      setError(null)
    } catch {
      setError("Couldn't remove the deadline — try again.")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mb-4 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 p-3 text-xs space-y-2">
        <p className="font-semibold">{day?.deadlineTime ? 'Edit deadline' : 'Set deadline'}</p>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            aria-label="Deadline time"
            autoFocus
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setError(null)
            }}
            className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </button>
          {day?.deadlineTime && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }

  if (state.kind === 'empty') {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={openEditor}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ⏱ Set Deadline
        </button>
      </div>
    )
  }

  if (state.kind === 'success') {
    return (
      <div className="mb-4 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs flex items-center justify-between gap-2">
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          ✅ All done — {formatCountdown(state.remainingMs)} to spare
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={openEditor} aria-label="Edit deadline" className="hover:text-indigo-600">
            ✏️
          </button>
          <button type="button" onClick={handleRemove} aria-label="Remove deadline" className="hover:text-red-600">
            ✕
          </button>
        </span>
      </div>
    )
  }

  if (state.kind === 'expired') {
    return (
      <div className="mb-4 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-500/10 p-3 text-xs flex items-center justify-between gap-2">
        <span className="font-medium text-red-700 dark:text-red-400">
          {state.tasksRemaining === 0
            ? '✅ Deadline met — all tasks done'
            : `⏰ Deadline passed — ${state.tasksRemaining} task${state.tasksRemaining === 1 ? '' : 's'} incomplete`}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={openEditor} aria-label="Edit deadline" className="hover:text-indigo-600">
            ✏️
          </button>
          <button type="button" onClick={handleRemove} aria-label="Remove deadline" className="hover:text-red-600">
            ✕
          </button>
        </span>
      </div>
    )
  }

  // active / warning / critical
  return (
    <div className={`mb-4 rounded-lg border p-3 text-xs flex items-center justify-between gap-2 ${URGENCY_STYLE[state.kind]}`}>
      <span className="flex items-center gap-2">
        <span aria-hidden>{URGENCY_ICON[state.kind]}</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{formatCountdown(state.remainingMs)}</span>
        <span className="text-slate-500 dark:text-slate-400">due {day?.deadlineTime}</span>
        <span className="text-slate-500 dark:text-slate-400">
          · {state.tasksRemaining} task{state.tasksRemaining === 1 ? '' : 's'} left
        </span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={openEditor} aria-label="Edit deadline" className="hover:text-indigo-600">
          ✏️
        </button>
        <button type="button" onClick={handleRemove} aria-label="Remove deadline" className="hover:text-red-600">
          ✕
        </button>
      </span>
    </div>
  )
}

export function DeadlineBarSkeleton() {
  return <div className="mb-4 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
}
