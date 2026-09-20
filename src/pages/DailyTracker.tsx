import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AddTaskForm, { type AddTaskPrefill } from '../components/AddTaskForm'
import BulkActionToolbar from '../components/BulkActionToolbar'
import CompletionFollowUp from '../components/CompletionFollowUp'
import DayNav from '../components/DayNav'
import HabitWidget from '../components/HabitWidget'
import ImportCsvModal from '../components/ImportCsvModal'
import QuickAddBar from '../components/QuickAddBar'
import RolloverPrompt from '../components/RolloverPrompt'
import TaskRow from '../components/TaskRow'
import TemplatesPanel from '../components/TemplatesPanel'
import { db } from '../db/db'
import {
  PRIORITIES,
  dayUnitTotals,
  isTaskComplete,
  sortByPriority,
  type Priority,
  type Task,
} from '../db/models'
import { useSettings } from '../context/SettingsContext'
import { addDays, todayKey } from '../lib/date'
import { weekStart } from '../lib/aggregate'
import { markWeeklyPlanPrompted, shouldPromptWeeklyPlan } from '../lib/planningWizard'
import { capacityPercent, isCapacityEnabled, minutesUnitPlanned } from '../lib/capacity'

export default function DailyTracker() {
  const { date } = useParams<{ date: string }>()
  const activeDate = date ?? todayKey()
  const { settings } = useSettings()
  const [sortPriority, setSortPriority] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [planBannerDismissed, setPlanBannerDismissed] = useState(false)
  const [justCompleted, setJustCompleted] = useState<{ task: Task; completionEventId: string | null } | null>(null)
  function handleJustCompleted(task: Task, completionEventId: string | null) {
    setJustCompleted({ task, completionEventId })
  }
  const [prefill, setPrefill] = useState<AddTaskPrefill | undefined>(undefined)
  const [prefillNonce, setPrefillNonce] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const day = useLiveQuery(() => db.days.where('date').equals(activeDate).first(), [activeDate])
  const tasks = useLiveQuery(async () => {
    if (!day) return []
    return db.tasks.where('dayId').equals(day.id).toArray()
  }, [day])

  const allTasks = tasks ?? []
  const visibleTasks = priorityFilter === 'all' ? allTasks : allTasks.filter((t) => t.priority === priorityFilter)

  let activeTasks = visibleTasks.filter((t) => !isTaskComplete(t))
  let completedTasks = visibleTasks.filter((t) => isTaskComplete(t))
  if (sortPriority) {
    activeTasks = sortByPriority(activeTasks)
    completedTasks = sortByPriority(completedTasks)
  } else {
    activeTasks = [...activeTasks].sort((a, b) => a.createdAt - b.createdAt)
    completedTasks = [...completedTasks].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const unitTotals = dayUnitTotals(allTasks)
  const moveCompleted = settings.completedBehavior === 'move'

  const capacityOn = isCapacityEnabled(settings.capacityMode, settings.capacityMinutes)
  const weekTasksForCapacity =
    useLiveQuery(async () => {
      if (!capacityOn || settings.capacityMode !== 'weekly') return []
      const start = weekStart(activeDate)
      const end = addDays(start, 6)
      const weekDays = await db.days.where('date').between(start, end, true, true).toArray()
      const dayIds = weekDays.map((d) => d.id)
      return dayIds.length ? db.tasks.where('dayId').anyOf(dayIds).toArray() : []
      // eslint-disable-next-line react-hooks/exhaustive-deps -- capacityOn/mode gate whether this queries at all
    }, [activeDate, capacityOn, settings.capacityMode]) ?? []
  const capacityPlanned = settings.capacityMode === 'weekly' ? minutesUnitPlanned(weekTasksForCapacity) : minutesUnitPlanned(allTasks)
  const capacityPct = capacityPercent(capacityPlanned, settings.capacityMinutes)

  const isTodayView = activeDate === todayKey()
  const currentWeek = weekStart(todayKey())
  const showPlanBanner = isTodayView && !planBannerDismissed && shouldPromptWeeklyPlan(currentWeek)

  const selectedTasks = allTasks.filter((t) => selectedIds.has(t.id))

  function renderTask(task: Task) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        dayTasks={allTasks}
        onJustCompleted={handleJustCompleted}
        selectable={selectionMode}
        selected={selectedIds.has(task.id)}
        onToggleSelect={() => toggleSelect(task.id)}
      />
    )
  }

  return (
    <div>
      <DayNav date={activeDate} />

      <div className="flex justify-end mb-2">
        <Link to={`/timeblock/${activeDate}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          🗓 Time-Blocking view →
        </Link>
      </div>

      <QuickAddBar
        date={activeDate}
        onManualFallback={(recognized) => {
          setPrefill(recognized)
          setPrefillNonce((n) => n + 1)
        }}
      />

      {showPlanBanner && (
        <div className="mb-4 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 text-xs flex items-center justify-between gap-2">
          <span>It's a new week — want a task plan suggested from your goals?</span>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/plan"
              onClick={() => {
                markWeeklyPlanPrompted(currentWeek)
                setPlanBannerDismissed(true)
              }}
              className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-semibold"
            >
              Plan Week
            </Link>
            <button
              type="button"
              onClick={() => {
                markWeeklyPlanPrompted(currentWeek)
                setPlanBannerDismissed(true)
              }}
              className="text-slate-500 dark:text-slate-400 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isTodayView && <RolloverPrompt date={activeDate} />}

      <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2">
        {unitTotals.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Day progress — no tasks yet.</p>
        ) : (
          unitTotals.map((ut) => (
            <div key={ut.key}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 dark:text-slate-400">
                  Day progress{unitTotals.length > 1 ? ` (${ut.label})` : ''}
                </span>
                <span className="font-medium tabular-nums">
                  {ut.done} / {ut.planned} {ut.label} ({ut.percent}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={ut.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Day progress, ${ut.label}`}
                className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
              >
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${ut.percent}%` }} />
              </div>
            </div>
          ))
        )}
      </div>

      {capacityOn && (
        <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-slate-400">Capacity ({settings.capacityMode})</span>
            <span className="font-medium tabular-nums">
              {capacityPlanned} / {settings.capacityMinutes} min ({capacityPct}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={capacityPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Capacity used"
            className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all ${
                capacityPct >= 100 ? 'bg-red-500' : capacityPct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, capacityPct)}%` }}
            />
          </div>
        </div>
      )}

      {justCompleted && (
        <CompletionFollowUp
          task={justCompleted.task}
          completionEventId={justCompleted.completionEventId}
          onDone={() => setJustCompleted(null)}
        />
      )}

      <HabitWidget date={activeDate} />

      <AddTaskForm
        key={`${activeDate}-${prefillNonce}`}
        defaultDate={activeDate}
        onToggleTemplates={() => setTemplatesOpen((v) => !v)}
        prefill={prefillNonce > 0 ? prefill : undefined}
      />

      {templatesOpen && <TemplatesPanel date={activeDate} onClose={() => setTemplatesOpen(false)} />}

      <button
        type="button"
        onClick={() => setImportOpen(true)}
        className="mb-3 text-[11px] px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        ⬆ Import CSV
      </button>

      {importOpen && <ImportCsvModal defaultDate={activeDate} onClose={() => setImportOpen(false)} />}

      {allTasks.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setSortPriority((v) => !v)}
            className={
              sortPriority
                ? 'px-2.5 py-1 rounded-full bg-indigo-600 text-white font-medium'
                : 'px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }
          >
            Sort by priority
          </button>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
            aria-label="Filter by priority"
            className="px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} only
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
            className={
              selectionMode
                ? 'ml-auto px-2.5 py-1 rounded-full bg-indigo-600 text-white font-medium'
                : 'ml-auto px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }
          >
            {selectionMode ? 'Done selecting' : 'Select'}
          </button>
        </div>
      )}

      {selectionMode && selectedTasks.length > 0 && <BulkActionToolbar selectedTasks={selectedTasks} onDone={exitSelectionMode} />}

      {allTasks.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
          No tasks for this day yet. Add one above to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {moveCompleted ? (
            <>
              <ul className="space-y-2">{activeTasks.map(renderTask)}</ul>
              {completedTasks.length > 0 && (
                <details open className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Completed ({completedTasks.length})
                  </summary>
                  <ul className="space-y-2">{completedTasks.map(renderTask)}</ul>
                </details>
              )}
            </>
          ) : (
            <ul className="space-y-2">
              {(sortPriority
                ? sortByPriority([...activeTasks, ...completedTasks])
                : [...activeTasks, ...completedTasks].sort((a, b) => a.createdAt - b.createdAt)
              ).map(renderTask)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
