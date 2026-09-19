import clsx from 'clsx'
import { useState, type KeyboardEvent } from 'react'
import { db, logCompletionEvent } from '../db/db'
import {
  PRIORITIES,
  clampCompleted,
  isTaskComplete,
  isTaskLocked,
  minutesDone,
  percentComplete,
  totalMinutes,
  type Priority,
  type Task,
} from '../db/models'
import FocusTimer from './FocusTimer'
import NamedSubtasks from './NamedSubtasks'
import VoiceNoteRecorder from './VoiceNoteRecorder'

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

const PRIORITY_STYLE: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const CATEGORY_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#a855f7']

export default function TaskRow({
  task,
  dayTasks,
  onJustCompleted,
}: {
  task: Task
  dayTasks: Task[]
  /** Called once when this task transitions to 100% — parent shows the energy prompt / webhook retry so it survives this row moving to the Completed section. */
  onJustCompleted?: (task: Task) => void
}) {
  const complete = isTaskComplete(task)
  const percent = percentComplete(task)
  const done = minutesDone(task)
  const total = totalMinutes(task)
  const [notesOpen, setNotesOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const tasksById = new Map(dayTasks.map((t) => [t.id, t]))
  const locked = isTaskLocked(task, tasksById)
  const dependencyOptions = dayTasks.filter((t) => t.id !== task.id)
  const dependency = task.dependsOnTaskId ? tasksById.get(task.dependsOnTaskId) : undefined

  async function commitCompleted(value: number, actualMinutes?: number) {
    const clamped = clampCompleted(value, task.totalSubtasks)
    if (clamped === task.completedSubtasks) return
    const wasComplete = complete
    const patch: Partial<Task> = { completedSubtasks: clamped, updatedAt: Date.now() }
    if (actualMinutes !== undefined) {
      patch.actualMinutes = (task.actualMinutes ?? 0) + actualMinutes
    }
    await db.tasks.update(task.id, patch)
    await logCompletionEvent(task.id, clamped - task.completedSubtasks)
    const nowComplete = clamped === task.totalSubtasks && task.totalSubtasks > 0
    if (!wasComplete && nowComplete) {
      onJustCompleted?.({ ...task, ...patch, completedSubtasks: clamped })
    }
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

  async function commitDependsOn(value: string) {
    await db.tasks.update(task.id, { dependsOnTaskId: value || undefined, updatedAt: Date.now() })
  }

  async function toggleNamedSubtasks() {
    if (task.subtaskItems) {
      await db.tasks.update(task.id, { subtaskItems: undefined, updatedAt: Date.now() })
    } else {
      const items = Array.from({ length: task.totalSubtasks }, (_, i) => ({
        id: `${task.id}-${i}`,
        title: `Subtask ${i + 1}`,
        completed: i < task.completedSubtasks,
      }))
      await db.tasks.update(task.id, { subtaskItems: items, updatedAt: Date.now() })
    }
  }

  async function commitCategory(label: string, color: string, icon: string) {
    if (!label.trim()) {
      await db.tasks.update(task.id, { category: undefined })
    } else {
      await db.tasks.update(task.id, { category: { label: label.trim(), color, icon: icon.trim() || '🏷️' } })
    }
    setCategoryOpen(false)
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
        locked && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {locked && (
              <span title={`Locked until "${dependency?.title}" is complete`} aria-label="Task locked" className="text-xs">
                🔒
              </span>
            )}
            {task.category && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${task.category.color}22`, color: task.category.color }}
              >
                {task.category.icon} {task.category.label}
              </span>
            )}
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
          {task.rolledOverFromTitle && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">↪ rolled over from {task.rolledOverFromTitle}</p>
          )}
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
              disabled={!!task.subtaskItems}
              aria-label="Total subtasks"
              className={clsx('w-12 text-right tabular-nums', fieldClass, task.subtaskItems && 'opacity-50')}
            />
            <span>subtasks</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => setCategoryOpen((v) => !v)}
            aria-label="Set category"
            className="text-xs text-slate-300 dark:text-slate-600 hover:text-slate-500"
          >
            🏷️
          </button>
          <button
            type="button"
            onClick={() => setSubtasksOpen((v) => !v)}
            aria-label="Toggle named subtasks"
            className={clsx('text-xs', task.subtaskItems ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500')}
          >
            ☑
          </button>
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

      {categoryOpen && (
        <CategoryEditor
          initial={task.category}
          onSave={commitCategory}
          onCancel={() => setCategoryOpen(false)}
        />
      )}

      {dependencyOptions.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Depends on:</span>
          <select
            value={task.dependsOnTaskId ?? ''}
            onChange={(e) => commitDependsOn(e.target.value)}
            aria-label="Depends on"
            className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">None</option>
            {dependencyOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {subtasksOpen && (
        <div className="mt-2 p-2 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900">
          <label className="flex items-center gap-1.5 text-[11px] font-medium mb-1">
            <input type="checkbox" checked={!!task.subtaskItems} onChange={toggleNamedSubtasks} />
            Use named subtasks
          </label>
          {task.subtaskItems && <NamedSubtasks task={task} />}
        </div>
      )}

      <VoiceNoteRecorder taskId={task.id} />

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-indigo-500')}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums w-9 text-right">{percent}%</span>
      </div>

      {!task.subtaskItems && (
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => commitCompleted(task.completedSubtasks - 1)}
            disabled={task.completedSubtasks <= 0 || locked}
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
            disabled={locked}
            onChange={(e) => commitCompleted(Number(e.target.value))}
            onBlur={(e) => commitCompleted(Number(e.target.value))}
            className="w-14 text-center px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs tabular-nums disabled:opacity-50"
            aria-label={`Completed subtasks for ${task.title}`}
          />
          <button
            type="button"
            onClick={() => commitCompleted(task.completedSubtasks + 1)}
            disabled={task.completedSubtasks >= task.totalSubtasks || locked}
            className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
            aria-label="Increment completed subtasks"
          >
            +
          </button>
          <span className="text-[11px] text-slate-400">of {task.totalSubtasks} subtasks</span>
          <button
            type="button"
            onClick={() => setFocusOpen(true)}
            disabled={complete || locked}
            className="ml-auto text-[11px] px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
          >
            ▶ Start Focus
          </button>
        </div>
      )}

      {focusOpen && (
        <FocusTimer
          task={task}
          onClose={() => setFocusOpen(false)}
          onComplete={(actualMinutes) => commitCompleted(task.completedSubtasks + 1, actualMinutes)}
        />
      )}
    </li>
  )
}

function CategoryEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Task['category']
  onSave: (label: string, color: string, icon: string) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[0])
  const [icon, setIcon] = useState(initial?.icon ?? '')

  return (
    <div className="mt-2 p-2 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 flex items-center gap-1.5 flex-wrap">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Category (e.g. Work)"
        maxLength={30}
        className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-28"
      />
      <input
        type="text"
        value={icon}
        onChange={(e) => setIcon(e.target.value.slice(0, 2))}
        placeholder="🏷️"
        className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-10 text-center"
      />
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setColor(c)}
          aria-label={`Color ${c}`}
          className={clsx('w-4 h-4 rounded-full', color === c && 'ring-2 ring-offset-1 ring-slate-400')}
          style={{ backgroundColor: c }}
        />
      ))}
      <button type="button" onClick={() => onSave(label, color, icon)} className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-600 text-white font-medium">
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-[11px] px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600">
        Cancel
      </button>
    </div>
  )
}
