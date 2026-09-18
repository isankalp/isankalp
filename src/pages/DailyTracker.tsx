import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import AddTaskForm from '../components/AddTaskForm'
import DayNav from '../components/DayNav'
import TaskRow from '../components/TaskRow'
import { db } from '../db/db'
import { dayMinutesDone, dayMinutesPlanned, dayPercentComplete, isTaskComplete } from '../db/models'
import { useSettings } from '../context/SettingsContext'
import { todayKey } from '../lib/date'

export default function DailyTracker() {
  const { date } = useParams<{ date: string }>()
  const activeDate = date ?? todayKey()
  const { settings } = useSettings()

  const day = useLiveQuery(() => db.days.where('date').equals(activeDate).first(), [activeDate])
  const tasks = useLiveQuery(async () => {
    if (!day) return []
    return db.tasks.where('dayId').equals(day.id).toArray()
  }, [day])

  const allTasks = tasks ?? []
  const activeTasks = [...allTasks].filter((t) => !isTaskComplete(t)).sort((a, b) => a.createdAt - b.createdAt)
  const completedTasks = [...allTasks]
    .filter((t) => isTaskComplete(t))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const planned = dayMinutesPlanned(allTasks)
  const doneMin = dayMinutesDone(allTasks)
  const dayPercent = dayPercentComplete(allTasks)
  const moveCompleted = settings.completedBehavior === 'move'

  return (
    <div>
      <DayNav date={activeDate} />

      <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-500 dark:text-slate-400">Day progress</span>
          <span className="font-medium tabular-nums">
            {doneMin} / {planned} min ({dayPercent}%)
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${dayPercent}%` }} />
        </div>
      </div>

      <AddTaskForm key={activeDate} defaultDate={activeDate} />

      {allTasks.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-slate-400 py-10">
          No tasks for this day yet. Add one above to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {moveCompleted ? (
            <>
              <ul className="space-y-3">
                {activeTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
              {completedTasks.length > 0 && (
                <details open className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                    Completed ({completedTasks.length})
                  </summary>
                  <ul className="space-y-3">
                    {completedTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <ul className="space-y-3">
              {[...activeTasks, ...completedTasks]
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
