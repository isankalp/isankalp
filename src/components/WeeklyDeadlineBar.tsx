import { useEffect, useState } from 'react'
import type { Task, WeeklyPlan } from '../db/models'
import { computeWeeklyDeadlineBarState, formatWeeklyCountdown, weeklyPlanState } from '../lib/weekly'

interface Props<T extends Pick<Task, 'blockedAt' | 'totalSubtasks' | 'completedSubtasks'>> {
  plan: Pick<WeeklyPlan, 'fromDate' | 'fromTime' | 'toDate' | 'toTime'>
  tasks: T[]
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

/** Epic 95: the plan's To moment is always its deadline (WD-1) — unlike the daily Deadline Bar,
 *  there's no "Set Deadline" action here, since editing the deadline means editing the plan's own
 *  period via WeeklyPlanForm. This just renders whichever of the five states (Upcoming/Active/
 *  Warning/Success/Expired) computeWeeklyDeadlineBarState says applies right now, ticking every
 *  second while the plan hasn't ended (WD-2/WD-4). */
export default function WeeklyDeadlineBar<T extends Pick<Task, 'blockedAt' | 'totalSubtasks' | 'completedSubtasks'>>({ plan, tasks }: Props<T>) {
  const [now, setNow] = useState(() => Date.now())
  const state = computeWeeklyDeadlineBarState(plan, tasks, now)

  useEffect(() => {
    if (weeklyPlanState(plan, now) === 'ended') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.fromDate, plan.fromTime, plan.toDate, plan.toTime])

  if (state.kind === 'upcoming') {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs flex items-center gap-2">
        <span aria-hidden>⏳</span>
        <span className="font-medium">Starts in {formatWeeklyCountdown(state.startsInMs)}</span>
      </div>
    )
  }

  if (state.kind === 'success') {
    return (
      <div className="mb-4 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs">
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          ✅ All done, {formatWeeklyCountdown(state.remainingMs)} to spare
        </span>
      </div>
    )
  }

  if (state.kind === 'expired') {
    return (
      <div className="mb-4 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-500/10 p-3 text-xs">
        <span className="font-medium text-red-700 dark:text-red-400">
          {state.tasksRemaining === 0
            ? '✅ Deadline met, all tasks done'
            : `⏰ Deadline passed, ${state.tasksRemaining} task${state.tasksRemaining === 1 ? '' : 's'} incomplete`}
        </span>
      </div>
    )
  }

  // active / warning / critical
  return (
    <div className={`mb-4 rounded-lg border p-3 text-xs flex items-center gap-2 ${URGENCY_STYLE[state.kind]}`}>
      <span aria-hidden>{URGENCY_ICON[state.kind]}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">{formatWeeklyCountdown(state.remainingMs)}</span>
      <span className="text-slate-500 dark:text-slate-400">
        · {state.tasksRemaining} task{state.tasksRemaining === 1 ? '' : 's'} left
      </span>
    </div>
  )
}
