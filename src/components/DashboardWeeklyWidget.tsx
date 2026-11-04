import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { dayAggregatePercent } from '../db/models'
import { tasksRemainingCount } from '../lib/deadline'
import { formatWeeklyCountdown, weeklyPlanDisplayName, weeklyPlanState, weeklyPlanToTimestamp } from '../lib/weekly'

/** Epic 98 (WI-2/WI-3/WI-4): lists every currently Active plan, nearest-end-time first, each with
 *  its percent, live countdown and tasks-remaining count; renders nothing at all when none are
 *  Active. Tapping a plan opens its detail view. */
export default function DashboardWeeklyWidget() {
  const plans = useLiveQuery(() => db.weeklyPlans.toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.weeklyTasks.toArray(), []) ?? []
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  const activePlans = plans
    .filter((p) => weeklyPlanState(p, now) === 'active')
    .sort((a, b) => weeklyPlanToTimestamp(a) - weeklyPlanToTimestamp(b))

  useEffect(() => {
    if (activePlans.length === 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlans.length])

  if (activePlans.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {activePlans.map((plan) => {
        const planTasks = tasks.filter((t) => t.planId === plan.id)
        const percent = dayAggregatePercent(planTasks)
        const remaining = tasksRemainingCount(planTasks)
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => navigate(`/weekly/${plan.id}`)}
            className="w-full text-left p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm truncate">{weeklyPlanDisplayName(plan)}</span>
              {percent !== null && <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{percent}%</span>}
            </div>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
              {formatWeeklyCountdown(weeklyPlanToTimestamp(plan) - now)} left · {remaining} task{remaining === 1 ? '' : 's'} remaining
            </p>
          </button>
        )
      })}
    </div>
  )
}
