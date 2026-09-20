import {
  dayAggregatePercent,
  dayCompletionState,
  dayMinutesDone,
  dayMinutesPlanned,
  type Day,
  type DayCompletionState,
  type Task,
} from '../db/models'
import { addDays, parseDateKey, todayKey, toDateKey } from './date'

export interface DayTotal {
  date: string
  planned: number
  done: number
}

export type Period = 'day' | 'week' | 'month'

export function tasksByDayId(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = map.get(task.dayId) ?? []
    list.push(task)
    map.set(task.dayId, list)
  }
  return map
}

/** Per-day totals for every Day that has tasks, sorted ascending by date. */
export function dailyTotals(days: Day[], tasks: Task[]): DayTotal[] {
  const byDayId = tasksByDayId(tasks)
  return days
    .map((day) => {
      const dayTasks = byDayId.get(day.id) ?? []
      return { date: day.date, planned: dayMinutesPlanned(dayTasks), done: dayMinutesDone(dayTasks) }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface DayCompletionSummary {
  date: string
  state: DayCompletionState
  percent: number | null
}

/** Epic 72/73: one entry per Day, the binary completion state (for calendar color) and the
 *  cross-unit aggregate percent (for the detail view) computed together so both always agree on
 *  which tasks they're looking at. */
export function dailyCompletionSummaries(days: Day[], tasks: Task[]): DayCompletionSummary[] {
  const byDayId = tasksByDayId(tasks)
  return days.map((day) => {
    const dayTasks = byDayId.get(day.id) ?? []
    return { date: day.date, state: dayCompletionState(dayTasks), percent: dayAggregatePercent(dayTasks) }
  })
}

export function weekStart(date: string): string {
  const d = parseDateKey(date)
  const dow = d.getDay() // 0 = Sunday
  return addDays(date, -dow)
}

export function monthKey(date: string): string {
  return date.slice(0, 7) // YYYY-MM
}

export function bucketTotals(totals: DayTotal[], period: Period): { label: string; planned: number; done: number }[] {
  if (period === 'day') return totals.map((t) => ({ label: t.date.slice(5), planned: t.planned, done: t.done }))

  const keyFn = period === 'week' ? weekStart : monthKey
  const buckets = new Map<string, { planned: number; done: number }>()
  for (const t of totals) {
    const key = keyFn(t.date)
    const bucket = buckets.get(key) ?? { planned: 0, done: 0 }
    bucket.planned += t.planned
    bucket.done += t.done
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label, ...v }))
}

/** Restrict to a trailing window ending today, in the given unit. */
export function trailingWindow(totals: DayTotal[], count: number, unit: 'days' | 'weeks' | 'months'): DayTotal[] {
  const today = todayKey()
  const daysBack = unit === 'days' ? count : unit === 'weeks' ? count * 7 : count * 31
  const cutoff = addDays(today, -daysBack)
  return totals.filter((t) => t.date >= cutoff && t.date <= today)
}

export function breakdownByTitle(tasks: Task[], days: Day[], sinceDate: string): { title: string; minutes: number }[] {
  const dayDateById = new Map(days.map((d) => [d.id, d.date]))
  const totals = new Map<string, number>()
  for (const task of tasks) {
    const date = dayDateById.get(task.dayId)
    if (!date || date < sinceDate) continue
    const minutes = task.minutesPerSubtask * task.completedSubtasks
    totals.set(task.title, (totals.get(task.title) ?? 0) + minutes)
  }
  return [...totals.entries()]
    .map(([title, minutes]) => ({ title, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function fillMissingDays(totals: DayTotal[], startDate: string, endDate: string): DayTotal[] {
  const byDate = new Map(totals.map((t) => [t.date, t]))
  const result: DayTotal[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    result.push(byDate.get(cursor) ?? { date: cursor, planned: 0, done: 0 })
    cursor = addDays(cursor, 1)
  }
  return result
}

export { toDateKey }
