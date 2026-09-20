import { dayMinutesDone, dayMinutesPlanned, dayPercentComplete, unitKey as taskUnitKey, unitLabel, type Day, type Task } from '../db/models'
import { addDays, todayKey } from './date'

export interface HeatmapDay {
  date: string
  planned: number
  done: number
  percent: number
}

export interface HeatmapFilter {
  unitKey?: string
  category?: string
}

const WEEKS = 53

/** The first date shown in a WEEKS-week grid ending on `endDate` (inclusive of both ends). */
export function heatmapRangeStart(endDate: string): string {
  return addDays(endDate, -(WEEKS * 7 - 1))
}

function matchesFilter(task: Task, filter: HeatmapFilter): boolean {
  if (filter.unitKey && taskUnitKey(task) !== filter.unitKey) return false
  if (filter.category && task.category?.label !== filter.category) return false
  return true
}

/**
 * CH-1/CH-5: one cell per day for the trailing year, shaded by percentComplete.
 * Restricted to a single unit (CH-1's "minutes-unit tasks only, or a user-selected unit") and
 * optionally a category/tag, so different units are never summed into one percentage (CU-4).
 */
export function computeHeatmapDays(days: Day[], tasks: Task[], filter: HeatmapFilter = {}, endDate: string = todayKey()): HeatmapDay[] {
  const startDate = heatmapRangeStart(endDate)
  const filtered = tasks.filter((t) => matchesFilter(t, filter))
  const dayIdToDate = new Map(days.map((d) => [d.id, d.date]))
  const tasksByDate = new Map<string, Task[]>()
  for (const task of filtered) {
    const date = dayIdToDate.get(task.dayId)
    if (!date) continue
    const list = tasksByDate.get(date) ?? []
    list.push(task)
    tasksByDate.set(date, list)
  }

  const result: HeatmapDay[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const dayTasks = tasksByDate.get(cursor) ?? []
    result.push({
      date: cursor,
      planned: dayMinutesPlanned(dayTasks),
      done: dayMinutesDone(dayTasks),
      percent: dayPercentComplete(dayTasks),
    })
    cursor = addDays(cursor, 1)
  }
  return result
}

export interface UnitOption {
  key: string
  label: string
}

/** Distinct units present across all tasks, for the heatmap's unit filter dropdown. */
export function availableUnits(tasks: Task[]): UnitOption[] {
  const seen = new Map<string, string>()
  for (const task of tasks) {
    const key = taskUnitKey(task)
    if (!seen.has(key)) seen.set(key, unitLabel(task))
  }
  return [...seen.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => (a.key === 'minutes' ? -1 : b.key === 'minutes' ? 1 : a.label.localeCompare(b.label)))
}

/** Distinct category/tag labels present across all tasks, for the heatmap's tag filter dropdown. */
export function availableCategories(tasks: Task[]): string[] {
  const seen = new Set<string>()
  for (const task of tasks) {
    if (task.category?.label) seen.add(task.category.label)
  }
  return [...seen].sort()
}

export function shadeLevel(percent: number): 0 | 1 | 2 | 3 | 4 {
  if (percent <= 0) return 0
  if (percent < 25) return 1
  if (percent < 50) return 2
  if (percent < 75) return 3
  return 4
}

export function hasAnyHistory(heatmapDays: HeatmapDay[]): boolean {
  return heatmapDays.some((d) => d.planned > 0)
}
