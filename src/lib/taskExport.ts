import { db } from '../db/db'
import {
  isTaskBlocked,
  isTaskComplete,
  minutesDone,
  percentComplete,
  totalMinutes,
  unitLabel,
  type CustomFieldDef,
  type Day,
  type Task,
} from '../db/models'
import { toCsvRow } from './csv'
import { todayKey } from './date'

export type TaskExportStatus = 'Active' | 'Completed' | 'Blocked' | 'Rejected'

/** EF-4/EF-6/SX-10: Rejected and Blocked are checked before Completed so a task carrying partial
 *  progress while Blocked/Rejected is never mislabeled Completed, on any of its exported rows.
 *  Mutually exclusive by construction (rejectBlockedTask always clears blockedAt), but checked
 *  defensively anyway. */
export function taskExportStatus(task: Task): TaskExportStatus {
  if (task.blockedRejectedAt !== undefined) return 'Rejected'
  if (isTaskBlocked(task)) return 'Blocked'
  if (isTaskComplete(task)) return 'Completed'
  return 'Active'
}

/** The task-level columns from Epic 88, excluding Date (placed separately — see COLUMNS below) and
 *  Title (kept here since the PRD's "existing Epic 88 columns" still includes it, distinct from the
 *  new Main Task column added for Epic 90). */
const TASK_COLUMNS = [
  'Title',
  'Status',
  'Unit',
  'Amount Per Subtask',
  'Total Subtasks',
  'Completed Subtasks',
  'Total Amount',
  'Amount Done',
  'Percent Complete',
  'Priority',
  'Tags',
  'Notes',
  'Blocked On',
  'Created At',
]

export type SubtaskStatus = 'Done' | 'Not Done'

interface ExpandedSubtaskRow {
  task: Task
  mainTask: string
  subtaskIndex: number
  subtaskName: string
  subtaskStatus: SubtaskStatus
}

/**
 * Epic 90 (SX-1/SX-2/SX-5/SX-8/SC-3): a task with named subtasks expands into one row per item, in
 * the order they're shown in the app (SX-6 relies on this order being preserved, not re-sorted). A
 * task with none — numeric-mode tasks, or a named-subtask list that's empty (SC-3; blocked at save
 * by GL-5, so only a defensive case) — exports as exactly one row self-linked to its own name,
 * whose Done/Not Done status reflects the task's own 100% completion rather than any item.
 */
function expandTaskToSubtaskRows(task: Task): ExpandedSubtaskRow[] {
  const items = task.subtaskItems
  if (items && items.length > 0) {
    return items.map((item, i) => ({
      task,
      mainTask: task.title,
      subtaskIndex: i + 1,
      subtaskName: item.title,
      subtaskStatus: item.completed ? 'Done' : 'Not Done',
    }))
  }
  return [
    {
      task,
      mainTask: task.title,
      subtaskIndex: 1,
      subtaskName: task.title,
      subtaskStatus: isTaskComplete(task) ? 'Done' : 'Not Done',
    },
  ]
}

/** EF-10: joined with semicolons into a single cell. This codebase's only tag-like field today is
 *  the single category label (AddTaskForm's own UI calls it a "tag") — exported as a one-element
 *  list rather than hardcoding a single value, so this keeps working if multi-tag support is ever added. */
function taskTags(task: Task): string[] {
  return task.category ? [task.category.label] : []
}

/** SX-9: the Epic 88 task-level values, identical on every one of this task's expanded rows. */
function taskLevelValues(task: Task, customFields: CustomFieldDef[]): string[] {
  return [
    task.title,
    taskExportStatus(task),
    unitLabel(task),
    String(task.minutesPerSubtask),
    String(task.totalSubtasks),
    String(task.completedSubtasks),
    String(totalMinutes(task)),
    String(minutesDone(task)),
    String(percentComplete(task)),
    task.priority,
    taskTags(task).join('; '),
    task.notes ?? '',
    task.blockedReason ?? '',
    new Date(task.createdAt).toISOString(),
    ...customFields.map((f) => String(task.customFieldValues?.[f.id] ?? '')),
  ]
}

/**
 * EF-1/EF-2/EF-3/EF-9/SX-1..12/SC-1..7: builds the full CSV — one row per subtask (or one
 * self-linked row for a task with none), across every date, tasks sorted by date then creation
 * order with each task's own rows kept adjacent in subtask order (SX-6). Task-level columns repeat
 * identically on every row of the same task (SX-9). Pure given its inputs — the data-pulling lives
 * in buildTaskExport below, kept separate so this part is trivially unit-testable.
 */
export function buildTaskExportCsv(
  tasks: Task[],
  days: Day[],
  customFields: CustomFieldDef[],
): { csv: string; rowCount: number } {
  const dayById = new Map(days.map((d) => [d.id, d]))
  const columns = [
    'Date',
    'Main Task',
    'Subtask #',
    'Subtask',
    'Subtask Status',
    ...TASK_COLUMNS,
    ...customFields.map((f) => f.name),
    'Task ID',
  ]

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = dayById.get(a.dayId)?.date ?? ''
    const dateB = dayById.get(b.dayId)?.date ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return a.createdAt - b.createdAt
  })

  const lines = [toCsvRow(columns)]
  let rowCount = 0
  for (const task of sortedTasks) {
    const date = dayById.get(task.dayId)?.date ?? ''
    const taskValues = taskLevelValues(task, customFields)
    for (const subtaskRow of expandTaskToSubtaskRows(task)) {
      const row = [
        date,
        subtaskRow.mainTask,
        String(subtaskRow.subtaskIndex),
        subtaskRow.subtaskName,
        subtaskRow.subtaskStatus,
        ...taskValues,
        task.id,
      ]
      lines.push(toCsvRow(row))
      rowCount++
    }
  }
  return { csv: lines.join('\r\n'), rowCount }
}

/** EF-12: the export date, not any task date — deterministic per calendar day. */
export function taskExportFilename(exportDate: string = todayKey()): string {
  return `goal-tracker-tasks-${exportDate}.csv`
}

export interface TaskExportResult {
  csv: string
  /** Distinct tasks in the export (SC-1's "N"), never the row count. */
  taskCount: number
  /** Total data rows written, after subtask expansion (SC-1's "R"). */
  rowCount: number
  filename: string
}

/** EX-2/EX-9: every task across every date for the active account/profile (db is already scoped to
 *  it), never just the selected day. EX-8/SC-7: read-only — three toArray() reads, no writes. */
export async function buildTaskExport(): Promise<TaskExportResult> {
  const [tasks, days, customFields] = await Promise.all([db.tasks.toArray(), db.days.toArray(), db.customFields.toArray()])
  const { csv, rowCount } = buildTaskExportCsv(tasks, days, customFields)
  return {
    csv,
    taskCount: tasks.length,
    rowCount,
    filename: taskExportFilename(),
  }
}

/** Triggers the actual browser download, same Blob+anchor pattern as exportImport.ts's
 *  downloadExport. A UTF-8 BOM is prepended so Excel reliably detects the encoding instead of
 *  garbling non-English characters (EF-8/SX-11). */
export function downloadTaskExportCsv(result: TaskExportResult): void {
  const blob = new Blob(['﻿' + result.csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  a.click()
  URL.revokeObjectURL(url)
}
