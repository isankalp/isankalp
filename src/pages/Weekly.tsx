import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { dayAggregatePercent, type WeeklyPlan } from '../db/models'
import ExportWeeklyTasksButton from '../components/ExportWeeklyTasksButton'
import WeeklyPlanForm from '../components/WeeklyPlanForm'
import {
  duplicateWeeklyPlan,
  formatWeeklyCountdown,
  weeklyPlanDisplayName,
  weeklyPlanState,
  weeklyPlanToTimestamp,
  type WeeklyPlanState,
} from '../lib/weekly'

const STATE_LABEL: Record<WeeklyPlanState, string> = { upcoming: 'Upcoming', active: 'Active', ended: 'Ended' }
const STATE_STYLE: Record<WeeklyPlanState, string> = {
  upcoming: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  active: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  ended: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

/** Epic 92: the Weekly tab — lists every plan with its state, percent, and (for Active plans) a
 *  live countdown; "New Weekly Plan" and "Export Weekly Tasks" sit in the header (WX-1). */
export default function Weekly() {
  const navigate = useNavigate()
  const plansRaw = useLiveQuery(() => db.weeklyPlans.toArray(), [])
  const tasksRaw = useLiveQuery(() => db.weeklyTasks.toArray(), [])
  const loading = plansRaw === undefined || tasksRaw === undefined
  const plans = plansRaw ?? []
  const tasks = tasksRaw ?? []
  const [now, setNow] = useState(() => Date.now())
  const [creating, setCreating] = useState(false)
  const [editingPlan, setEditingPlan] = useState<WeeklyPlan | null>(null)
  const [duplicatingPlan, setDuplicatingPlan] = useState<WeeklyPlan | null>(null)
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<WeeklyPlan | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const hasActivePlan = plans.some((p) => weeklyPlanState(p, now) === 'active')
  useEffect(() => {
    if (!hasActivePlan) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasActivePlan])

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-3">Weekly</h2>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  const tasksByPlanId = new Map<string, typeof tasks>()
  for (const task of tasks) {
    const list = tasksByPlanId.get(task.planId) ?? []
    list.push(task)
    tasksByPlanId.set(task.planId, list)
  }

  const sorted = [...plans].sort((a, b) => {
    const stateA = weeklyPlanState(a, now)
    const stateB = weeklyPlanState(b, now)
    const rank: Record<WeeklyPlanState, number> = { active: 0, upcoming: 1, ended: 2 }
    if (rank[stateA] !== rank[stateB]) return rank[stateA] - rank[stateB]
    if (stateA === 'upcoming') return weeklyPlanToTimestamp(a) - weeklyPlanToTimestamp(b)
    if (stateA === 'ended') return weeklyPlanToTimestamp(b) - weeklyPlanToTimestamp(a)
    return weeklyPlanToTimestamp(a) - weeklyPlanToTimestamp(b)
  })

  async function handleDeleteConfirm() {
    if (!confirmDeletePlan) return
    const planTasks = tasksByPlanId.get(confirmDeletePlan.id) ?? []
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(planTasks.map((t) => db.weeklyTasks.delete(t.id)))
      await db.weeklyPlans.delete(confirmDeletePlan.id)
    })
    setConfirmDeletePlan(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-lg font-bold">Weekly</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-2.5 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
          >
            + New Weekly Plan
          </button>
          <ExportWeeklyTasksButton />
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">No weekly plans yet, create your first one</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
          >
            + New Weekly Plan
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((plan) => {
            const planTasks = tasksByPlanId.get(plan.id) ?? []
            const state = weeklyPlanState(plan, now)
            const percent = dayAggregatePercent(planTasks)
            const taskCount = planTasks.length
            return (
              <li key={plan.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => navigate(`/weekly/${plan.id}`)} className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{weeklyPlanDisplayName(plan)}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATE_STYLE[state]}`}>{STATE_LABEL[state]}</span>
                      {plan.deadlineOutcome && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            plan.deadlineOutcome === 'met'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                          }`}
                        >
                          {plan.deadlineOutcome === 'met' ? 'Met' : 'Missed'}
                        </span>
                      )}
                      {percent !== null && <span className="text-[11px] text-slate-500 dark:text-slate-400">{percent}%</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {plan.fromDate} {plan.fromTime} → {plan.toDate} {plan.toTime}
                    </p>
                    {state === 'active' && (
                      <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {formatWeeklyCountdown(weeklyPlanToTimestamp(plan) - now)} left
                      </p>
                    )}
                  </button>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setMenuOpenId((id) => (id === plan.id ? null : plan.id))}
                      aria-label={`Actions for ${weeklyPlanDisplayName(plan)}`}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
                    >
                      ⋯
                    </button>
                    {menuOpenId === plan.id && (
                      <div className="absolute right-0 top-full mt-1 z-20 flex flex-col items-start gap-0.5 whitespace-nowrap rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-[11px] shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlan(plan)
                            setMenuOpenId(null)
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicatingPlan(plan)
                            setMenuOpenId(null)
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeletePlan(plan)
                            setMenuOpenId(null)
                          }}
                          className="text-red-600 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {taskCount === 0 && <p className="text-[11px] text-slate-400 mt-1">No tasks yet.</p>}
              </li>
            )
          })}
        </ul>
      )}

      {creating && (
        <WeeklyPlanForm
          onSaved={(plan) => {
            setCreating(false)
            navigate(`/weekly/${plan.id}`)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editingPlan && (
        <WeeklyPlanForm
          plan={editingPlan}
          onSaved={() => setEditingPlan(null)}
          onCancel={() => setEditingPlan(null)}
        />
      )}

      {duplicatingPlan && (
        <DuplicatePlanForm
          plan={duplicatingPlan}
          onSaved={(plan) => {
            setDuplicatingPlan(null)
            navigate(`/weekly/${plan.id}`)
          }}
          onCancel={() => setDuplicatingPlan(null)}
        />
      )}

      {confirmDeletePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-800 p-4 space-y-3">
            <p className="text-sm">
              Delete "{weeklyPlanDisplayName(confirmDeletePlan)}"? This permanently removes it and{' '}
              {(tasksByPlanId.get(confirmDeletePlan.id) ?? []).length} task
              {(tasksByPlanId.get(confirmDeletePlan.id) ?? []).length === 1 ? '' : 's'} inside it. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeletePlan(null)} className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteConfirm} className="px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-semibold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** WP-11: duplicate dates only — the plan's tasks/subtasks all clone as-is (progress reset) once saved. */
function DuplicatePlanForm({ plan, onSaved, onCancel }: { plan: WeeklyPlan; onSaved: (plan: WeeklyPlan) => void; onCancel: () => void }) {
  const [fromDate, setFromDate] = useState('')
  const [fromTime, setFromTime] = useState(plan.fromTime)
  const [toDate, setToDate] = useState('')
  const [toTime, setToTime] = useState(plan.toTime)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!fromDate || !fromTime || !toDate || !toTime) {
      setError('All four fields are required.')
      return
    }
    if (`${toDate}T${toTime}` <= `${fromDate}T${fromTime}`) {
      setError('End must be after start')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const newPlan = await duplicateWeeklyPlan(plan, { fromDate, fromTime, toDate, toTime })
      onSaved(newPlan)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-800 p-4 space-y-3">
        <p className="text-sm font-semibold">Duplicate "{weeklyPlanDisplayName(plan)}"</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Pick a new period — every task and subtask will be copied with progress reset to 0.</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="block">
            <span className="text-slate-500 dark:text-slate-400">From date</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700" />
          </label>
          <label className="block">
            <span className="text-slate-500 dark:text-slate-400">From time</span>
            <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700" />
          </label>
          <label className="block">
            <span className="text-slate-500 dark:text-slate-400">To date</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700" />
          </label>
          <label className="block">
            <span className="text-slate-500 dark:text-slate-400">To time</span>
            <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700" />
          </label>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  )
}
