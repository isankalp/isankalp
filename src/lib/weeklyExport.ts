import { db } from '../db/db'
import type { CustomFieldDef, WeeklyPlan, WeeklyTask } from '../db/models'
import { expandTaskToSubtaskRows, taskLevelValues } from './taskExport'
import { toCsvRow } from './csv'
import { todayKey } from './date'
import { weeklyPlanDisplayName, weeklyPlanFromTimestamp, weeklyPlanToTimestamp } from './weekly'

/** WX-7: the Epic 88 task-level columns, reused verbatim from the daily export — minus Title, since
 *  Main Task already covers the task's name here (WX-7's own column list has no separate Title). */
const TASK_COLUMNS = [
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

/**
 * Epic 97 (WX-4..9): one CSV row per subtask (or one self-linked row for a task with none, exactly
 * as the daily export's SX-1..5 rule — directly reused via expandTaskToSubtaskRows), across every
 * plan regardless of state, sorted by Plan From ascending then task creation order, with each
 * task's own rows kept adjacent (WX-8). Task-level columns repeat identically on every row of the
 * same task, reusing the exact same taskLevelValues the daily export uses (WX-7), just without its
 * Title column.
 */
export function buildWeeklyTaskExportCsv(
  tasks: WeeklyTask[],
  plans: WeeklyPlan[],
  customFields: CustomFieldDef[],
): { csv: string; rowCount: number } {
  const planById = new Map(plans.map((p) => [p.id, p]))
  const columns = [
    'Plan Name',
    'Plan From',
    'Plan To',
    'Main Task',
    'Subtask #',
    'Subtask',
    'Subtask Status',
    ...TASK_COLUMNS,
    ...customFields.map((f) => f.name),
    'Task ID',
  ]

  const sortedTasks = [...tasks].sort((a, b) => {
    const fromA = planById.get(a.planId) ? weeklyPlanFromTimestamp(planById.get(a.planId)!) : 0
    const fromB = planById.get(b.planId) ? weeklyPlanFromTimestamp(planById.get(b.planId)!) : 0
    if (fromA !== fromB) return fromA - fromB
    return a.createdAt - b.createdAt
  })

  const lines = [toCsvRow(columns)]
  let rowCount = 0
  for (const task of sortedTasks) {
    const plan = planById.get(task.planId)
    const planName = plan ? weeklyPlanDisplayName(plan) : ''
    const planFrom = plan ? new Date(weeklyPlanFromTimestamp(plan)).toISOString() : ''
    const planTo = plan ? new Date(weeklyPlanToTimestamp(plan)).toISOString() : ''
    const taskValues = taskLevelValues(task, customFields, { includeTitle: false })
    for (const subtaskRow of expandTaskToSubtaskRows(task)) {
      const row = [
        planName,
        planFrom,
        planTo,
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

/** Distinct from the daily export's filename (WX-16: the two exports never mix). */
export function weeklyTaskExportFilename(exportDate: string = todayKey()): string {
  return `goal-tracker-weekly-tasks-${exportDate}.csv`
}

export interface WeeklyTaskExportResult {
  csv: string
  taskCount: number
  rowCount: number
  filename: string
}

/** WX-2/WX-15: every weekly task across every plan and state for the active account/profile (db is
 *  already scoped to it). WX-15: read-only — three toArray() reads, no writes. */
export async function buildWeeklyTaskExport(): Promise<WeeklyTaskExportResult> {
  const [tasks, plans, customFields] = await Promise.all([db.weeklyTasks.toArray(), db.weeklyPlans.toArray(), db.customFields.toArray()])
  const { csv, rowCount } = buildWeeklyTaskExportCsv(tasks, plans, customFields)
  return {
    csv,
    taskCount: tasks.length,
    rowCount,
    filename: weeklyTaskExportFilename(),
  }
}

/** Same Blob+anchor download pattern as taskExport.ts's downloadTaskExportCsv. */
export function downloadWeeklyTaskExportCsv(result: WeeklyTaskExportResult): void {
  const blob = new Blob(['﻿' + result.csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  a.click()
  URL.revokeObjectURL(url)
}
