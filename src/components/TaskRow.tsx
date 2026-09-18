import clsx from 'clsx'
import { useState, type KeyboardEvent } from 'react'
import { db } from '../db/db'
import {
  PRIORITIES,
  clampCompleted,
  isTaskComplete,
  minutesDone,
  percentComplete,
  totalMinutes,
  type Priority,
  type Task,
} from '../db/models'
import FocusTimer from './FocusTimer'

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

const PRIORITY_STYLE: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

export default function TaskRow({ task }: { task: Task }) {
  const complete = isTaskComplete(task)
  const percent = percentComplete(task)
  const done = minutesDone(task)
  const total = totalMinutes(task)
  const [notesOpen, setNotesOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)

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

  async function commitPriority(priority: Priority) {
    await db.tasks.update(task.id, { priority, updatedAt: Date.now() })
  }

  async function commitNotes(value: string) {
    await db.tasks.update(task.id, { notes: value, updatedAt: Date.now() })
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
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              defaultValue={task.title}
              key={`${task.id}-title`}
              onBlur={(e) => commitTitle(e.target.value)}
              onKeyDown={blurOnEnter}
              maxLength={120}
              aria-label="Task title"
              className={clsx(
                'font-semibold text-sm flex-1 min-w-0',
                fieldClass,
                complete && 'line-through text-slate-500 dark:text-slate-400',
              )}
            />
            <select
              value={task.priority}
              onChange={(e) => commitPriority(e.target.value as Priority)}
              aria-label="Priority"
              className={clsx('text-[10px] font-medium rounded-full px-1.5 py-0.5 border-0 shrink-0', PRIORITY_STYLE[task.priority])}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
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
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            aria-label={task.notes ? 'Edit note' : 'Add note'}
            className={clsx(
              'text-xs',
              task.notes ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500',
            )}
          >
            📝
          </button>
          <button type="button" onClick={deleteTask} aria-label={`Delete ${task.title}`} className="text-slate-400 hover:text-red-600 text-xs">
            ✕
          </button>
        </div>
      </div>

      {notesOpen && (
        <textarea
          defaultValue={task.notes ?? ''}
          key={`${task.id}-notes`}
          onBlur={(e) => commitNotes(e.target.value)}
          placeholder="Add a note for this task..."
          maxLength={2000}
          rows={2}
          aria-label="Task notes"
          className="mt-2 w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 resize-y"
        />
      )}

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
        <button
          type="button"
          onClick={() => setFocusOpen(true)}
          disabled={complete}
          className="ml-auto text-[11px] px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        >
          ▶ Start Focus
        </button>
      </div>

      {focusOpen && (
        <FocusTimer
          task={task}
          onClose={() => setFocusOpen(false)}
          onComplete={() => commitCompleted(task.completedSubtasks + 1)}
        />
      )}
    </li>
  )
}
