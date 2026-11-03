import { useLiveQuery } from '../hooks/useLiveQuery'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AddTaskForm, { type AddTaskPrefill } from '../components/AddTaskForm'
import BulkActionToolbar from '../components/BulkActionToolbar'
import CommandBar from '../components/CommandBar'
import CompletionFollowUp from '../components/CompletionFollowUp'
import DayNav from '../components/DayNav'
import ExportTasksButton from '../components/ExportTasksButton'
import HabitWidget from '../components/HabitWidget'
import ImportCsvModal from '../components/ImportCsvModal'
import JournalEntryBox, { type JournalEntryBoxHandle } from '../components/JournalEntryBox'
import QuickAddBar, { type QuickAddBarHandle } from '../components/QuickAddBar'
import RolloverPrompt from '../components/RolloverPrompt'
import TaskRow from '../components/TaskRow'
import TemplatesPanel from '../components/TemplatesPanel'
import { db } from '../db/db'
import {
  PRIORITIES,
  dayUnitTotals,
  isTaskBlocked,
  isTaskComplete,
  sortByPriority,
  type Priority,
  type Task,
} from '../db/models'
import BlockedItemsPanel from '../components/BlockedItemsPanel'
import ChartErrorBoundary from '../components/ChartErrorBoundary'
import DeadlineBar from '../components/DeadlineBar'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useAiClient } from '../hooks/useAiClient'
import { addDays, todayKey } from '../lib/date'
import { weekStart } from '../lib/aggregate'
import { markWeeklyPlanPrompted, shouldPromptWeeklyPlan } from '../lib/planningWizard'
import { capacityPercent, isCapacityEnabled, minutesUnitPlanned } from '../lib/capacity'

export default function DailyTracker() {
  const { date } = useParams<{ date: string }>()
  const activeDate = date ?? todayKey()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusAdd = searchParams.get('focus') === 'add'
  const focusTaskId = searchParams.get('task')
  const { settings } = useSettings()
  const { showToast } = useToast()
  const { configured: aiConfigured } = useAiClient()
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const journalRef = useRef<JournalEntryBoxHandle>(null)
  const quickAddRef = useRef<QuickAddBarHandle>(null)
  const [journalDirty, setJournalDirty] = useState(false)
  const [quickAddDirty, setQuickAddDirty] = useState(false)
  const [pendingNavDate, setPendingNavDate] = useState<string | null>(null)
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

  // LR-11: Journal/Quick-Add's own onDirtyChange calls land here, so the day-nav guard below
  // always reads the live dirty state at the moment of an attempted navigation.
  function handleDayNavigate(targetDate: string) {
    if (journalDirty || quickAddDirty) {
      setPendingNavDate(targetDate)
    } else {
      navigate(`/day/${targetDate}`)
    }
  }

  async function handleConfirmSave() {
    if (!pendingNavDate) return
    if (journalDirty) await journalRef.current?.flush()
    if (quickAddDirty) await quickAddRef.current?.trySave()
    setJournalDirty(false)
    setQuickAddDirty(false)
    const target = pendingNavDate
    setPendingNavDate(null)
    navigate(`/day/${target}`)
  }

  function handleDiscardNav() {
    if (!pendingNavDate) return
    setJournalDirty(false)
    setQuickAddDirty(false)
    const target = pendingNavDate
    setPendingNavDate(null)
    navigate(`/day/${target}`)
  }

  const day = useLiveQuery(() => db.days.where('date').equals(activeDate).first(), [activeDate])
  const tasks = useLiveQuery(async () => {
    if (!day) return []
    return db.tasks.where('dayId').equals(day.id).toArray()
  }, [day])

  const allTasks = tasks ?? []
  const visibleTasks = priorityFilter === 'all' ? allTasks : allTasks.filter((t) => t.priority === priorityFilter)

  let activeTasks = visibleTasks.filter((t) => !isTaskComplete(t) && !isTaskBlocked(t))
  let completedTasks = visibleTasks.filter((t) => isTaskComplete(t))
  let blockedTasks = visibleTasks.filter((t) => isTaskBlocked(t))
  if (sortPriority) {
    activeTasks = sortByPriority(activeTasks)
    completedTasks = sortByPriority(completedTasks)
    blockedTasks = sortByPriority(blockedTasks)
  } else {
    activeTasks = [...activeTasks].sort((a, b) => a.createdAt - b.createdAt)
    completedTasks = [...completedTasks].sort((a, b) => b.updatedAt - a.updatedAt)
    blockedTasks = [...blockedTasks].sort((a, b) => (b.blockedAt ?? 0) - (a.blockedAt ?? 0))
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

  // DB-4/LR-7: Dashboard's "+ Add Task" links here with ?focus=add — scrolls to and focuses the
  // bottom Quick-Add bar (not the manual AddTaskForm), then consumes the param once so a later
  // visit to the same URL (e.g. browser back) doesn't keep re-stealing focus.
  useEffect(() => {
    if (!focusAdd) return
    const el = document.querySelector('[aria-label="Quick add task"]') as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus()
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('focus')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount when focusAdd is set
  }, [])

  // DB-5: Dashboard's pending-task tap links here with ?task={id} — scroll it into view and
  // briefly highlight it, then drop the param so re-visiting the URL doesn't re-trigger it.
  useEffect(() => {
    if (!focusTaskId || !tasks) return
    const el = document.getElementById(`task-${focusTaskId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-indigo-500')
    const timeout = setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 2000)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('task')
      return next
    }, { replace: true })
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once tasks are loaded for this focusTaskId
  }, [focusTaskId, tasks])

  function renderTask(task: Task) {
    if (!day) return null
    return (
      <TaskRow
        key={task.id}
        task={task}
        dayTasks={allTasks}
        day={day}
        onJustCompleted={handleJustCompleted}
        selectable={selectionMode}
        selected={selectedIds.has(task.id)}
        onToggleSelect={() => toggleSelect(task.id)}
      />
    )
  }

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <DayNav date={activeDate} onNavigate={handleDayNavigate} />
        </div>
        <ExportTasksButton />
      </div>

      <div className="flex justify-end mb-2">
        <Link to={`/timeblock/${activeDate}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          🗓 Time-Blocking view →
        </Link>
      </div>

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

      {activeDate >= todayKey() && (
        <ChartErrorBoundary label="the deadline timer">
          <DeadlineBar date={activeDate} day={day} tasks={allTasks} />
        </ChartErrorBoundary>
      )}

      {isTodayView && <BlockedItemsPanel />}

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
              {blockedTasks.length > 0 && (
                <details open className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Blocked ({blockedTasks.length})
                  </summary>
                  <ul className="space-y-2">{blockedTasks.map(renderTask)}</ul>
                </details>
              )}
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
                ? sortByPriority([...activeTasks, ...blockedTasks, ...completedTasks])
                : [...activeTasks, ...blockedTasks, ...completedTasks].sort((a, b) => a.createdAt - b.createdAt)
              ).map(renderTask)}
            </ul>
          )}
        </div>
      )}

      {/* Epic 89 (LR-1/LR-2/LR-9): Journal, Habit Tracker, then Quick-Add — always below the task
          list and Completed section, in this order, even on an empty day. */}
      <JournalEntryBox ref={journalRef} date={activeDate} onDirtyChange={setJournalDirty} />

      <HabitWidget date={activeDate} />

      <div className="flex items-start gap-1.5">
        <div className="flex-1">
          <QuickAddBar
            ref={quickAddRef}
            date={activeDate}
            onDirtyChange={setQuickAddDirty}
            onCreated={() => showToast('Task added')}
            onManualFallback={(recognized) => {
              setPrefill(recognized)
              setPrefillNonce((n) => n + 1)
            }}
          />
        </div>
        {aiConfigured && (
          <button
            type="button"
            onClick={() => setCommandBarOpen((v) => !v)}
            aria-label="Free-form command"
            aria-pressed={commandBarOpen}
            className={`text-sm px-2 py-2 rounded-lg border ${
              commandBarOpen
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            ✨
          </button>
        )}
      </div>
      {commandBarOpen && <CommandBar onClose={() => setCommandBarOpen(false)} />}

      {pendingNavDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-800 p-4 space-y-3">
            <p className="text-sm font-semibold">Unsaved changes</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You have unsaved text in {journalDirty && quickAddDirty ? 'Journal and Quick-Add' : journalDirty ? 'Journal' : 'Quick-Add'}.
              Save it before switching days, or discard it?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNavDate(null)}
                className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscardNav}
                className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs text-red-600 dark:text-red-400"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold"
              >
                Save &amp; continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
