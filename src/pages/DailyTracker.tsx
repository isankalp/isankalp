import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AddTaskForm from '../components/AddTaskForm'
import DayNav from '../components/DayNav'
import HabitWidget from '../components/HabitWidget'
import TaskRow from '../components/TaskRow'
import TemplatesPanel from '../components/TemplatesPanel'
import { db } from '../db/db'
import {
  PRIORITIES,
  dayMinutesDone,
  dayMinutesPlanned,
  dayPercentComplete,
  isTaskComplete,
  sortByPriority,
  type Priority,
} from '../db/models'
import { useSettings } from '../context/SettingsContext'
import { todayKey } from '../lib/date'

export default function DailyTracker() {
  const { date } = useParams<{ date: string }>()
  const activeDate = date ?? todayKey()
  const { settings } = useSettings()
  const [sortPriority, setSortPriority] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [templatesOpen, setTemplatesOpen] = useState(false)

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

  const planned = dayMinutesPlanned(allTasks)
  const doneMin = dayMinutesDone(allTasks)
  const dayPercent = dayPercentComplete(allTasks)
  const moveCompleted = settings.completedBehavior === 'move'

  return (
    <div>
      <DayNav date={activeDate} />

      <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500 dark:text-slate-400">Day progress</span>
          <span className="font-medium tabular-nums">
            {doneMin} / {planned} min ({dayPercent}%)
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${dayPercent}%` }} />
        </div>
      </div>

      <HabitWidget date={activeDate} />

      <AddTaskForm key={activeDate} defaultDate={activeDate} onToggleTemplates={() => setTemplatesOpen((v) => !v)} />

      {templatesOpen && <TemplatesPanel date={activeDate} onClose={() => setTemplatesOpen(false)} />}

      {allTasks.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs">
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
        </div>
      )}

      {allTasks.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
          No tasks for this day yet. Add one above to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {moveCompleted ? (
            <>
              <ul className="space-y-2">
                {activeTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
              {completedTasks.length > 0 && (
                <details open className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Completed ({completedTasks.length})
                  </summary>
                  <ul className="space-y-2">
                    {completedTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <ul className="space-y-2">
              {(sortPriority
                ? sortByPriority([...activeTasks, ...completedTasks])
                : [...activeTasks, ...completedTasks].sort((a, b) => a.createdAt - b.createdAt)
              ).map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
