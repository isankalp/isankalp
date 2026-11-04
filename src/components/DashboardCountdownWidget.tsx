import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Day, Task } from '../db/models'
import { computeDeadlineBarState, formatCountdown } from '../lib/deadline'
import { todayKey } from '../lib/date'

interface Props {
  day: Day | undefined
  tasks: Task[]
}

const URGENCY_ICON: Record<'active' | 'warning' | 'critical', string> = {
  active: '⏱',
  warning: '⚠️',
  critical: '🔥',
}

/** DI-1: mirrors the Tasks tab's DeadlineBar state (same computeDeadlineBarState) so the two never
 *  disagree, but is read-only here — tapping navigates to the Tasks tab instead of opening an
 *  inline editor. CT-8: renders nothing at all when today has no deadline. */
export default function DashboardCountdownWidget({ day, tasks }: Props) {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const today = todayKey()
  const state = computeDeadlineBarState(day ?? { date: today }, tasks, now)

  useEffect(() => {
    if (state.kind === 'empty' || state.kind === 'expired') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, day?.deadlineTime])

  if (state.kind === 'empty') return null

  const label =
    state.kind === 'success'
      ? `✅ All done — ${formatCountdown(state.remainingMs)} to spare`
      : state.kind === 'expired'
        ? state.tasksRemaining === 0
          ? '✅ Deadline met — all tasks done'
          : `⏰ Deadline passed — ${state.tasksRemaining} task${state.tasksRemaining === 1 ? '' : 's'} incomplete`
        : `${URGENCY_ICON[state.kind]} ${formatCountdown(state.remainingMs)} · due ${day?.deadlineTime} · ${state.tasksRemaining} task${state.tasksRemaining === 1 ? '' : 's'} left`

  const toneClass =
    state.kind === 'critical' || state.kind === 'expired'
      ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
      : state.kind === 'warning'
        ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : state.kind === 'success'
          ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'

  return (
    <button
      type="button"
      onClick={() => navigate(`/day/${today}`)}
      className={`w-full mb-4 rounded-lg border p-3 text-xs text-left font-medium ${toneClass}`}
    >
      {label}
    </button>
  )
}
