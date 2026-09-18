import clsx from 'clsx'
import { db } from '../db/db'
import { clampCompleted, isTaskComplete, minutesDone, percentComplete, totalMinutes, type Task } from '../db/models'

export default function TaskRow({ task }: { task: Task }) {
  const complete = isTaskComplete(task)
  const percent = percentComplete(task)
  const done = minutesDone(task)
  const total = totalMinutes(task)

  async function commit(value: number) {
    const clamped = clampCompleted(value, task.totalSubtasks)
    if (clamped === task.completedSubtasks) return
    await db.tasks.update(task.id, { completedSubtasks: clamped, updatedAt: Date.now() })
  }

  async function deleteTask() {
    await db.tasks.delete(task.id)
  }

  return (
    <li
      className={clsx(
        'p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-opacity',
        complete && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={clsx('font-semibold', complete && 'line-through')}>{task.title}</p>
          <p className={clsx('text-sm text-slate-500 dark:text-slate-400', complete && 'line-through')}>
            {done} / {total} min &middot; {task.minutesPerSubtask} min &times; {task.totalSubtasks} subtasks
          </p>
        </div>
        <button
          type="button"
          onClick={deleteTask}
          aria-label={`Delete ${task.title}`}
          className="text-slate-400 hover:text-red-600 text-sm shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-indigo-500')}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums w-12 text-right">{percent}%</span>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => commit(task.completedSubtasks - 1)}
          disabled={task.completedSubtasks <= 0}
          className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Decrement completed subtasks"
        >
          −
        </button>
        <input
          type="number"
          value={task.completedSubtasks}
          min={0}
          max={task.totalSubtasks}
          onChange={(e) => commit(Number(e.target.value))}
          onBlur={(e) => commit(Number(e.target.value))}
          className="w-16 text-center px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm tabular-nums"
          aria-label={`Completed subtasks for ${task.title}`}
        />
        <button
          type="button"
          onClick={() => commit(task.completedSubtasks + 1)}
          disabled={task.completedSubtasks >= task.totalSubtasks}
          className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Increment completed subtasks"
        >
          +
        </button>
        <span className="text-xs text-slate-400">of {task.totalSubtasks} subtasks</span>
      </div>
    </li>
  )
}
