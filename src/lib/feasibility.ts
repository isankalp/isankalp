import type { Task } from '../db/models'
import { dayMinutesDone } from '../db/models'

export interface FeasibilityCheck {
  overBudget: boolean
  requiredDailyMinutes: number
  historicalDailyMinutes: number
  /** e.g. 40 means "this needs ~40% more time per day than your historical pace". */
  percentOver: number
}

/** GB-4: advisory only (GB-5) — never used to block saving, only to inform the user. */
export function checkFeasibility(
  proposedTotalMinutes: number,
  daysAvailable: number,
  historicalDailyMinutes: number,
): FeasibilityCheck {
  const requiredDailyMinutes = daysAvailable > 0 ? proposedTotalMinutes / daysAvailable : proposedTotalMinutes
  const percentOver =
    historicalDailyMinutes > 0 ? Math.round(((requiredDailyMinutes - historicalDailyMinutes) / historicalDailyMinutes) * 100) : 0
  const overBudget = historicalDailyMinutes > 0 && percentOver > 15
  return { overBudget, requiredDailyMinutes, historicalDailyMinutes, percentOver }
}

/** Average minutes actually completed per active day, over the given tasks/days (already scoped to
 *  a recent window by the caller) — the "actual historical completion rate" GB-4 compares against. */
export function historicalDailyPace(tasksByDay: Map<string, Task[]>): number {
  const activeDays = [...tasksByDay.values()].filter((tasks) => tasks.length > 0)
  if (activeDays.length === 0) return 0
  const total = activeDays.reduce((sum, tasks) => sum + dayMinutesDone(tasks), 0)
  return total / activeDays.length
}
