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

/** EF-4/EF-6: Rejected and Blocked are checked before Completed so a task carrying partial
 *  progress while Blocked/Rejected is never mislabeled Completed. Mutually exclusive by
 *  construction (rejectBlockedTask always clears blockedAt), but checked defensively anyway. */
export function taskExportStatus(task: Task): TaskExportStatus {
  if (task.blockedRejectedAt !== undefined) return 'Rejected'
  if (isTaskBlocked(task)) return 'Blocked'
  if (isTaskComplete(task)) return 'Completed'
  return 'Active'
}

const BASE_COLUMNS = [
  'Date',
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

/** EF-10: joined with semicolons into a single cell. This codebase's only tag-like field today is
 *  the single category label (AddTaskForm's own UI calls it a "tag") — exported as a one-element
 *  list rather than hardcoding a single value, so this keeps working if multi-tag support is ever added. */
function taskTags(task: Task): string[] {
  return task.category ? [task.category.label] : []
}

/**
 * EF-1/EF-2/EF-3/EF-9: builds the full CSV (header + one row per task, across every date, sorted by
 * date then creation order), with one extra column per custom field definition appended at the end
 * (EF-3), left empty for tasks with no value for it. Pure given its inputs — the data-pulling lives
 * in exportAllTasksCsv below, kept separate so this part is trivially unit-testable.
 */
export function buildTaskExportCsv(tasks: Task[], days: Day[], customFields: CustomFieldDef[]): string {
  const dayById = new Map(days.map((d) => [d.id, d]))
  const columns = [...BASE_COLUMNS, ...customFields.map((f) => f.name)]

  const sorted = [...tasks].sort((a, b) => {
    const dateA = dayById.get(a.dayId)?.date ?? ''
    const dateB = dayById.get(b.dayId)?.date ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return a.createdAt - b.createdAt
  })

  const lines = [toCsvRow(columns)]
  for (const task of sorted) {
    const date = dayById.get(task.dayId)?.date ?? ''
    const row = [
      date,
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
    lines.push(toCsvRow(row))
  }
  return lines.join('\r\n')
}

/** EF-12: the export date, not any task date — deterministic per calendar day. */
export function taskExportFilename(exportDate: string = todayKey()): string {
  return `goal-tracker-tasks-${exportDate}.csv`
}

export interface TaskExportResult {
  csv: string
  rowCount: number
  filename: string
}

/** EX-2/EX-9: every task across every date for the active account/profile (db is already scoped to
 *  it), never just the selected day. EX-8: read-only — three toArray() reads, no writes. */
export async function buildTaskExport(): Promise<TaskExportResult> {
  const [tasks, days, customFields] = await Promise.all([db.tasks.toArray(), db.days.toArray(), db.customFields.toArray()])
  return {
    csv: buildTaskExportCsv(tasks, days, customFields),
    rowCount: tasks.length,
    filename: taskExportFilename(),
  }
}

/** Triggers the actual browser download, same Blob+anchor pattern as exportImport.ts's
 *  downloadExport. A UTF-8 BOM is prepended so Excel reliably detects the encoding instead of
 *  garbling non-English characters (EF-8). */
export function downloadTaskExportCsv(result: TaskExportResult): void {
  const blob = new Blob(['﻿' + result.csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  a.click()
  URL.revokeObjectURL(url)
}
