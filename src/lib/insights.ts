import { dayPercentComplete, percentComplete, totalMinutes, type Day, type Task } from '../db/models'
import { parseDateKey } from './date'

export const MIN_HISTORY_WEEKS = 4

/** Rough span, in weeks, between the earliest and latest Day on record. */
export function weeksOfHistory(days: Day[]): number {
  if (days.length === 0) return 0
  const dates = days.map((d) => d.date).sort()
  const spanDays = (parseDateKey(dates[dates.length - 1]).getTime() - parseDateKey(dates[0]).getTime()) / (1000 * 60 * 60 * 24)
  return spanDays / 7
}

export interface WeekdayStat {
  weekday: number
  avgPercent: number
  dayCount: number
}

/** Average day-completion-percent grouped by weekday (0=Sunday..6=Saturday), for days that had at least one task. */
export function weekdayCompletionStats(days: Day[], tasks: Task[]): WeekdayStat[] {
  const tasksByDayId = new Map<string, Task[]>()
  for (const t of tasks) {
    const list = tasksByDayId.get(t.dayId) ?? []
    list.push(t)
    tasksByDayId.set(t.dayId, list)
  }
  const buckets = new Map<number, number[]>()
  for (const day of days) {
    const dayTasks = tasksByDayId.get(day.id) ?? []
    if (dayTasks.length === 0) continue
    const weekday = parseDateKey(day.date).getDay()
    const list = buckets.get(weekday) ?? []
    list.push(dayPercentComplete(dayTasks))
    buckets.set(weekday, list)
  }
  return [...buckets.entries()]
    .map(([weekday, percents]) => ({
      weekday,
      avgPercent: Math.round(percents.reduce((s, p) => s + p, 0) / percents.length),
      dayCount: percents.length,
    }))
    .sort((a, b) => a.weekday - b.weekday)
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Plain-language observations derived from weekday completion-rate variance. */
export function generateObservations(stats: WeekdayStat[]): string[] {
  if (stats.length === 0) return []
  const overall = stats.reduce((s, w) => s + w.avgPercent, 0) / stats.length
  const observations: string[] = []

  const weekend = stats.filter((s) => s.weekday === 0 || s.weekday === 6)
  const weekday = stats.filter((s) => s.weekday >= 1 && s.weekday <= 5)
  if (weekend.length && weekday.length) {
    const weekendAvg = weekend.reduce((s, w) => s + w.avgPercent, 0) / weekend.length
    const weekdayAvg = weekday.reduce((s, w) => s + w.avgPercent, 0) / weekday.length
    if (weekdayAvg > 0) {
      const diff = Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
      if (Math.abs(diff) >= 5) {
        observations.push(`You complete ${Math.abs(diff)}% ${diff > 0 ? 'more' : 'less'} on weekends than weekdays.`)
      }
    }
  }

  const sorted = [...stats].sort((a, b) => b.avgPercent - a.avgPercent)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  if (best && overall > 0) {
    const diff = Math.round(((best.avgPercent - overall) / overall) * 100)
    if (diff >= 5) observations.push(`${WEEKDAY_NAMES[best.weekday]}s are your strongest day — ${diff}% above your average.`)
  }
  if (worst && overall > 0 && worst.weekday !== best?.weekday) {
    const diff = Math.round(((overall - worst.avgPercent) / overall) * 100)
    if (diff >= 5) observations.push(`${WEEKDAY_NAMES[worst.weekday]}s tend to lag — ${diff}% below your average.`)
  }

  return observations
}

export interface HourBucket {
  hour: number
  count: number
}

/** Buckets positive completedSubtasks changes by hour-of-day of the update, not the task's creation time. */
export function timeOfDayBuckets(events: { at: number; delta: number }[]): HourBucket[] {
  const buckets = new Array(24).fill(0) as number[]
  for (const e of events) {
    if (e.delta <= 0) continue
    buckets[new Date(e.at).getHours()] += e.delta
  }
  return buckets.map((count, hour) => ({ hour, count }))
}

export interface EffortVarianceRow {
  title: string
  plannedMinutes: number
  actualMinutes: number
  variancePercent: number
}

/** Planned vs. actual (Focus Timer wall-clock) minutes for tasks that have logged actual time. */
export function effortVarianceRows(tasks: Task[]): EffortVarianceRow[] {
  return tasks
    .filter((t) => (t.actualMinutes ?? 0) > 0)
    .map((t) => {
      const planned = totalMinutes(t)
      const actual = t.actualMinutes ?? 0
      const variance = planned > 0 ? Math.round(((actual - planned) / planned) * 100) : 0
      return { title: t.title, plannedMinutes: Math.round(planned), actualMinutes: Math.round(actual), variancePercent: variance }
    })
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes)
    .slice(0, 10)
}

export const MIN_RATED_TASKS = 10

export interface EnergyCorrelationRow {
  rating: number
  avgPercent: number
  taskCount: number
}

/** Average completion rate segmented by energy rating, once at least MIN_RATED_TASKS tasks have one logged. */
export function energyCorrelation(tasks: Task[]): EnergyCorrelationRow[] {
  const rated = tasks.filter((t) => t.energyRating !== undefined)
  if (rated.length < MIN_RATED_TASKS) return []
  const buckets = new Map<number, number[]>()
  for (const t of rated) {
    const rating = t.energyRating as number
    const list = buckets.get(rating) ?? []
    list.push(percentComplete(t))
    buckets.set(rating, list)
  }
  return [1, 2, 3, 4, 5]
    .filter((r) => buckets.has(r))
    .map((r) => {
      const list = buckets.get(r) as number[]
      return { rating: r, avgPercent: Math.round(list.reduce((s, p) => s + p, 0) / list.length), taskCount: list.length }
    })
}
