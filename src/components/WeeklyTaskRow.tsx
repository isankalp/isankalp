import clsx from 'clsx'
import { useState, type KeyboardEvent } from 'react'
import { db } from '../db/db'
import { canMarkWeeklyTaskBlocked, canUnblockWeeklyTask } from '../lib/weeklyBlocked'
import {
  PRIORITIES,
  clampCompleted,
  isTaskBlocked,
  isTaskComplete,
  minutesDone,
  percentComplete,
  totalMinutes,
  unitLabel,
  type Priority,
  type WeeklyPlan,
  type WeeklyTask,
} from '../db/models'
import { CategoryEditor } from './TaskRow'
import WeeklyNamedSubtasks from './WeeklyNamedSubtasks'

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

const PRIORITY_STYLE: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

/** Epic 93/96 (WT-1..11, WB-1..5): a weekly task row — the same fields, math and Blocked flow as
 *  the daily TaskRow, minus daily-only integrations (Focus Timer, voice notes, photo evidence,
 *  history, dependency locking) that nothing in this PRD calls for. WT-11: never disabled by the
 *  plan having ended — every action here works identically regardless of plan state. */
export default function WeeklyTaskRow({ task, plan }: { task: WeeklyTask; plan: WeeklyPlan }) {
  const complete = isTaskComplete(task)
  const blocked = isTaskBlocked(task)
  const percent = percentComplete(task)
  const done = minutesDone(task)
  const total = totalMinutes(task)
  const unit = unitLabel(task)
  const [notesOpen, setNotesOpen] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [blockFormOpen, setBlockFormOpen] = useState(false)
  const [blockReasonDraft, setBlockReasonDraft] = useState('')
  const [blockedMenuOpen, setBlockedMenuOpen] = useState(false)

  async function commitField(patch: Partial<WeeklyTask>) {
    await db.weeklyTasks.update(task.id, { ...patch, updatedAt: Date.now() })
  }

  async function commitCompleted(value: number) {
    const clamped = clampCompleted(value, task.totalSubtasks)
    if (clamped === task.completedSubtasks) return
    await commitField({ completedSubtasks: clamped })
  }

  async function commitTitle(value: string) {
    const title = value.trim()
    if (!title || title === task.title) return
    await commitField({ title })
  }

  async function commitMinutesPerSubtask(value: string) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0 || n === task.minutesPerSubtask) return
    await commitField({ minutesPerSubtask: n })
  }

  async function commitTotalSubtasks(value: string) {
    const n = Math.max(1, Math.floor(Number(value)) || 1)
    if (n === task.totalSubtasks) return
    await commitField({ totalSubtasks: n, completedSubtasks: clampCompleted(task.completedSubtasks, n) })
  }

  async function commitPriority(priority: Priority) {
    await commitField({ priority })
  }

  async function commitNotes(value: string) {
    await commitField({ notes: value })
  }

  async function toggleNamedSubtasks() {
    if (task.subtaskItems) {
      await commitField({ subtaskItems: undefined })
    } else {
      const items = Array.from({ length: task.totalSubtasks }, (_, i) => ({
        id: `${task.id}-${i}`,
        title: `Subtask ${i + 1}`,
        completed: i < task.completedSubtasks,
      }))
      await commitField({ subtaskItems: items })
    }
  }

  async function commitCategory(label: string, color: string, icon: string) {
    const category = label.trim() ? { label: label.trim(), color, icon: icon.trim() || '🏷️' } : undefined
    await commitField({ category })
    setCategoryOpen(false)
  }

  async function deleteTask() {
    await db.weeklyTasks.delete(task.id)
  }

  async function confirmMarkBlocked() {
    await commitField({ blockedAt: Date.now(), blockedReason: blockReasonDraft.trim() || undefined, hasBeenBlocked: true })
    setBlockFormOpen(false)
    setBlockReasonDraft('')
  }

  async function unblockTask() {
    await commitField({ blockedAt: undefined, blockedReason: undefined })
    setBlockedMenuOpen(false)
  }

  const fieldClass =
    'bg-transparent border-b border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-solid focus:border-indigo-500 focus:outline-none px-0.5 -mx-0.5'

  return (
    <li
      data-weekly-task-row
      aria-label={`${task.title}, ${percent} percent complete, ${task.completedSubtasks} of ${task.totalSubtasks} subtasks${complete ? ', complete' : ''}${blocked ? ', blocked' : ''}`}
      className={clsx(
        'p-3 rounded-lg border',
        blocked
          ? 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        complete && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {blocked && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setBlockedMenuOpen((v) => !v)}
                  title={task.blockedReason ? `Blocked on: ${task.blockedReason}` : undefined}
                  aria-label={task.blockedReason ? `Blocked, on: ${task.blockedReason}` : 'Blocked'}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  🚫 Blocked
                </button>
                {blockedMenuOpen && canUnblockWeeklyTask(task, plan) && (
                  <div className="absolute left-0 top-full mt-1 z-20 flex flex-col items-start gap-0.5 whitespace-nowrap rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-[11px] shadow-lg">
                    <button type="button" onClick={unblockTask} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                      Unblock
                    </button>
                  </div>
                )}
              </div>
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
              className={clsx('font-semibold text-sm flex-1 min-w-0', fieldClass, complete && 'line-through text-slate-500 dark:text-slate-400')}
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
              {done} / {total} {unit} &middot;
            </span>
            <input
              type="number"
              defaultValue={task.minutesPerSubtask}
              key={`${task.id}-mps`}
              onBlur={(e) => commitMinutesPerSubtask(e.target.value)}
              onKeyDown={blurOnEnter}
              min={0.1}
              step="any"
              aria-label={`${unit} per subtask`}
              className={clsx('w-10 text-right tabular-nums', fieldClass)}
            />
            <span>{unit} &times;</span>
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
          <button type="button" onClick={() => setCategoryOpen((v) => !v)} aria-label="Set category" className="text-xs text-slate-300 dark:text-slate-600 hover:text-slate-500">
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
            className={clsx('text-xs', task.notes ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500')}
          >
            📝
          </button>
          {canMarkWeeklyTaskBlocked(task) && (
            <button type="button" onClick={() => setBlockFormOpen((v) => !v)} aria-label="Mark as Blocked" className="text-xs text-slate-300 dark:text-slate-600 hover:text-slate-500">
              🚫
            </button>
          )}
          <button type="button" onClick={deleteTask} aria-label={`Delete ${task.title}`} className="text-slate-400 hover:text-red-600 text-xs">
            ✕
          </button>
        </div>
      </div>

      {blockFormOpen && (
        <div className="mt-2 p-2 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 flex items-center gap-1.5 flex-wrap">
          <input
            type="text"
            value={blockReasonDraft}
            onChange={(e) => setBlockReasonDraft(e.target.value)}
            placeholder="Blocked on (optional)"
            maxLength={200}
            aria-label="Blocked on"
            className="flex-1 min-w-32 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <button type="button" onClick={confirmMarkBlocked} className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-600 text-white font-medium">
            Mark as Blocked
          </button>
          <button
            type="button"
            onClick={() => {
              setBlockFormOpen(false)
              setBlockReasonDraft('')
            }}
            className="text-[11px] px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </button>
        </div>
      )}

      {categoryOpen && <CategoryEditor initial={task.category} onSave={commitCategory} onCancel={() => setCategoryOpen(false)} />}

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
          {task.subtaskItems && <WeeklyNamedSubtasks task={task} />}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${task.title} progress`}
          className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
        >
          <div className={clsx('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums w-9 text-right">
          {complete && <span aria-hidden="true">✓ </span>}
          {percent}%
        </span>
      </div>

      {!task.subtaskItems && (
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => commitCompleted(task.completedSubtasks - 1)}
            disabled={task.completedSubtasks <= 0 || blocked}
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
            disabled={blocked}
            onChange={(e) => commitCompleted(Number(e.target.value))}
            onBlur={(e) => commitCompleted(Number(e.target.value))}
            className="w-14 text-center px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs tabular-nums disabled:opacity-50"
            aria-label={`Completed subtasks, ${task.completedSubtasks} of ${task.totalSubtasks}, ${percent} percent`}
          />
          <button
            type="button"
            onClick={() => commitCompleted(task.completedSubtasks + 1)}
            disabled={task.completedSubtasks >= task.totalSubtasks || blocked}
            className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
            aria-label="Increment completed subtasks"
          >
            +
          </button>
          <span className="text-[11px] text-slate-400">of {task.totalSubtasks} subtasks</span>
        </div>
      )}
    </li>
  )
}
