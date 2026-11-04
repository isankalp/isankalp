import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { dayAggregatePercent, dayUnitTotals, isTaskBlocked, isTaskComplete, sortByPriority, type WeeklyTask } from '../db/models'
import ChartErrorBoundary from '../components/ChartErrorBoundary'
import ExportWeeklyTasksButton from '../components/ExportWeeklyTasksButton'
import WeeklyAddTaskForm from '../components/WeeklyAddTaskForm'
import WeeklyBlockedItemsPanel from '../components/WeeklyBlockedItemsPanel'
import WeeklyDeadlineBar from '../components/WeeklyDeadlineBar'
import WeeklyPlanForm from '../components/WeeklyPlanForm'
import WeeklyTaskRow from '../components/WeeklyTaskRow'
import { weeklyPlanDisplayName } from '../lib/weekly'

/** Epic 93/94/95/96: one plan's detail view — Deadline Bar and Blocked Items panel at top (WD-1,
 *  WB-6), then plan totals, then the Active/Blocked/Completed task lists and the add-task form
 *  (WT-1..11). WT-11: nothing here is ever locked by the plan having ended. */
export default function WeeklyPlanDetail() {
  const { planId } = useParams<{ planId: string }>()
  const [editing, setEditing] = useState(false)

  const plan = useLiveQuery(() => (planId ? db.weeklyPlans.get(planId) : undefined), [planId])
  const tasks = useLiveQuery(() => (planId ? db.weeklyTasks.where('planId').equals(planId).toArray() : []), [planId])
  const loading = plan === undefined || tasks === undefined

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-2">
          <div className="h-6 w-48 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">This plan no longer exists.</p>
        <Link to="/weekly" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to Weekly
        </Link>
      </div>
    )
  }

  const allTasks = tasks ?? []
  let activeTasks = allTasks.filter((t) => !isTaskComplete(t) && !isTaskBlocked(t))
  let blockedTasks = allTasks.filter((t) => isTaskBlocked(t))
  let completedTasks = allTasks.filter((t) => isTaskComplete(t))
  activeTasks = sortByPriority(activeTasks)
  blockedTasks = [...blockedTasks].sort((a, b) => (b.blockedAt ?? 0) - (a.blockedAt ?? 0))
  completedTasks = [...completedTasks].sort((a, b) => b.updatedAt - a.updatedAt)

  const unitTotals = dayUnitTotals(allTasks)
  const aggregatePercent = dayAggregatePercent(allTasks)

  function renderTask(task: WeeklyTask) {
    return <WeeklyTaskRow key={task.id} task={task} plan={plan!} />
  }

  return (
    <div>
      <Link to="/weekly" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Back to Weekly
      </Link>

      <div className="flex items-start justify-between gap-2 mt-2 mb-3">
        <div>
          <h2 className="text-lg font-bold">{weeklyPlanDisplayName(plan)}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {plan.fromDate} {plan.fromTime} → {plan.toDate} {plan.toTime}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ExportWeeklyTasksButton />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Edit
          </button>
        </div>
      </div>

      <ChartErrorBoundary label="the plan deadline timer">
        <WeeklyDeadlineBar plan={plan} tasks={allTasks} />
      </ChartErrorBoundary>

      <WeeklyBlockedItemsPanel plan={plan} />

      <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2">
        {unitTotals.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Plan progress — no tasks yet.</p>
        ) : (
          <>
            {unitTotals.map((ut) => (
              <div key={ut.key}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Plan progress{unitTotals.length > 1 ? ` (${ut.label})` : ''}</span>
                  <span className="font-medium tabular-nums">
                    {ut.done} / {ut.planned} {ut.label} ({ut.percent}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={ut.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Plan progress, ${ut.label}`}
                  className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
                >
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${ut.percent}%` }} />
                </div>
              </div>
            ))}
            {aggregatePercent !== null && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {aggregatePercent}% of all subtasks complete (across units) · {activeTasks.length} Active, {completedTasks.length} Completed,{' '}
                {blockedTasks.length} Blocked
              </p>
            )}
          </>
        )}
      </div>

      <WeeklyAddTaskForm planId={plan.id} />

      {allTasks.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No tasks in this plan, add your first task</p>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">{activeTasks.map(renderTask)}</ul>
          {blockedTasks.length > 0 && (
            <details open className="group">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Blocked ({blockedTasks.length})</summary>
              <ul className="space-y-2">{blockedTasks.map(renderTask)}</ul>
            </details>
          )}
          {completedTasks.length > 0 && (
            <details open className="group">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Completed ({completedTasks.length})</summary>
              <ul className="space-y-2">{completedTasks.map(renderTask)}</ul>
            </details>
          )}
        </div>
      )}

      {editing && (
        <WeeklyPlanForm
          plan={plan}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}
