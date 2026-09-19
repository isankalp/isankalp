import type { ReviewPeriodType } from '../db/models'
import { monthKey, weekStart } from './aggregate'
import { addDays, addMonths, parseDateKey, todayKey } from './date'

export function currentPeriodKey(type: ReviewPeriodType, anchorDate: string): string {
  return type === 'week' ? weekStart(anchorDate) : monthKey(anchorDate)
}

export function periodRange(type: ReviewPeriodType, periodKey: string): { start: string; end: string } {
  if (type === 'week') {
    return { start: periodKey, end: addDays(periodKey, 6) }
  }
  const start = `${periodKey}-01`
  const firstOfNextMonth = addMonths(start, 1)
  return { start, end: addDays(firstOfNextMonth, -1) }
}

export function shiftPeriod(type: ReviewPeriodType, periodKey: string, delta: number): string {
  if (type === 'week') return addDays(periodKey, delta * 7)
  return addMonths(`${periodKey}-01`, delta).slice(0, 7)
}

export function isPeriodInProgress(type: ReviewPeriodType, periodKey: string): boolean {
  return periodRange(type, periodKey).end >= todayKey()
}

export function formatPeriodLabel(type: ReviewPeriodType, periodKey: string): string {
  if (type === 'month') {
    return parseDateKey(`${periodKey}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  const { start, end } = periodRange(type, periodKey)
  const startLabel = parseDateKey(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = parseDateKey(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `Week of ${startLabel} – ${endLabel}`
}

export function reviewId(type: ReviewPeriodType, periodKey: string): string {
  return `${type}:${periodKey}`
}
