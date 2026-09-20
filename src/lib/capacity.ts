import { dayMinutesPlanned, unitOf, type CapacityMode, type Task } from '../db/models'

export interface CapacityCheck {
  budget: number
  currentPlanned: number
  totalAfter: number
  overBudget: boolean
}

/** CP-5: capacity is fully opt-in — no warnings anywhere unless a positive budget is set. */
export function isCapacityEnabled(mode: CapacityMode, budgetMinutes: number): boolean {
  return mode !== 'off' && budgetMinutes > 0
}

/** Only minutes-unit tasks count toward a minutes capacity budget — consistent with how Stats/Calendar/Heatmap
 *  already scope minutes-based aggregates to avoid summing incompatible units (CU-4). */
export function minutesUnitPlanned(tasks: Task[]): number {
  return dayMinutesPlanned(tasks.filter((t) => unitOf(t) === 'minutes'))
}

/** CP-2: the accurate planned total, including this new task, against the budget — non-blocking, informational only. */
export function checkCapacity(existingTasks: Task[], addingMinutes: number, budgetMinutes: number): CapacityCheck {
  const currentPlanned = minutesUnitPlanned(existingTasks)
  const totalAfter = currentPlanned + addingMinutes
  return { budget: budgetMinutes, currentPlanned, totalAfter, overBudget: totalAfter > budgetMinutes }
}

export function capacityPercent(plannedMinutes: number, budgetMinutes: number): number {
  if (budgetMinutes <= 0) return 0
  return Math.round((plannedMinutes / budgetMinutes) * 100)
}
