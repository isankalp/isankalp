import clsx from 'clsx'
import type { KeyboardEvent } from 'react'
import { db } from '../db/db'
import { clampCompleted, isTaskComplete, minutesDone, percentComplete, totalMinutes, type Task } from '../db/models'

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

export default function TaskRow({ task }: { task: Task }) {
  const complete = isTaskComplete(task)
  const percent = percentComplete(task)
  const done = minutesDone(task)
  const total = totalMinutes(task)

  async function commitCompleted(value: number) {
    const clamped = clampCompleted(value, task.totalSubtasks)
    if (clamped === task.completedSubtasks) return
    await db.tasks.update(task.id, { completedSubtasks: clamped, updatedAt: Date.now() })
  }

  async function commitTitle(value: string) {
    const title = value.trim()
    if (!title || title === task.title) return
    await db.tasks.update(task.id, { title, updatedAt: Date.now() })
  }

  async function commitMinutesPerSubtask(value: string) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0 || n === task.minutesPerSubtask) return
    await db.tasks.update(task.id, { minutesPerSubtask: n, updatedAt: Date.now() })
  }

  async function commitTotalSubtasks(value: string) {
    const n = Math.max(1, Math.floor(Number(value)) || 1)
    if (n === task.totalSubtasks) return
    await db.tasks.update(task.id, {
      totalSubtasks: n,
      completedSubtasks: clampCompleted(task.completedSubtasks, n),
      updatedAt: Date.now(),
    })
  }

  async function deleteTask() {
    await db.tasks.delete(task.id)
  }

  const fieldClass =
    'bg-transparent border-b border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-solid focus:border-indigo-500 focus:outline-none px-0.5 -mx-0.5'

  return (
    <li
      className={clsx(
        'p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition-opacity',
        complete && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            defaultValue={task.title}
            key={`${task.id}-title`}
            onBlur={(e) => commitTitle(e.target.value)}
            onKeyDown={blurOnEnter}
            maxLength={120}
            aria-label="Task title"
            className={clsx(
              'font-semibold text-sm w-full',
              fieldClass,
              complete && 'line-through text-slate-500 dark:text-slate-400',
            )}
          />
          <p className={clsx('text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center flex-wrap gap-x-1', complete && 'line-through')}>
            <span>
              {done} / {total} min &middot;
            </span>
            <input
              type="number"
              defaultValue={task.minutesPerSubtask}
              key={`${task.id}-mps`}
              onBlur={(e) => commitMinutesPerSubtask(e.target.value)}
              onKeyDown={blurOnEnter}
              min={0.1}
              step="any"
              aria-label="Minutes per subtask"
              className={clsx('w-10 text-right tabular-nums', fieldClass)}
            />
            <span>min &times;</span>
            <input
              type="number"
              defaultValue={task.totalSubtasks}
              key={`${task.id}-total`}
              onBlur={(e) => commitTotalSubtasks(e.target.value)}
              onKeyDown={blurOnEnter}
              min={1}
              step={1}
              aria-label="Total subtasks"
              className={clsx('w-12 text-right tabular-nums', fieldClass)}
            />
            <span>subtasks</span>
          </p>
        </div>
        <button
          type="button"
          onClick={deleteTask}
          aria-label={`Delete ${task.title}`}
          className="text-slate-400 hover:text-red-600 text-xs shrink-0 mt-0.5"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-indigo-500')}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums w-9 text-right">{percent}%</span>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <button
          type="button"
          onClick={() => commitCompleted(task.completedSubtasks - 1)}
          disabled={task.completedSubtasks <= 0}
          className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
          aria-label="Decrement completed subtasks"
        >
          −
        </button>
        <input
          type="number"
          value={task.completedSubtasks}
          min={0}
          max={task.totalSubtasks}
          onChange={(e) => commitCompleted(Number(e.target.value))}
          onBlur={(e) => commitCompleted(Number(e.target.value))}
          className="w-14 text-center px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs tabular-nums"
          aria-label={`Completed subtasks for ${task.title}`}
        />
        <button
          type="button"
          onClick={() => commitCompleted(task.completedSubtasks + 1)}
          disabled={task.completedSubtasks >= task.totalSubtasks}
          className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
          aria-label="Increment completed subtasks"
        >
          +
        </button>
        <span className="text-[11px] text-slate-400">of {task.totalSubtasks} subtasks</span>
      </div>
    </li>
  )
}
