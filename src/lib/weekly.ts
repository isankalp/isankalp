import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { Task, WeeklyPlan, WeeklyTask } from '../db/models'
import { countdownUrgency, deadlineTimestamp, tasksRemainingCount, type CountdownUrgency } from './deadline'

/** WP-4: the default name shown whenever the user leaves the name field empty at creation. */
export function weeklyPlanDisplayName(plan: Pick<WeeklyPlan, 'name' | 'fromDate'>): string {
  return plan.name.trim() ? plan.name.trim() : `Week of ${plan.fromDate}`
}

export function weeklyPlanFromTimestamp(plan: Pick<WeeklyPlan, 'fromDate' | 'fromTime'>): number {
  return deadlineTimestamp(plan.fromDate, plan.fromTime)
}

export function weeklyPlanToTimestamp(plan: Pick<WeeklyPlan, 'toDate' | 'toTime'>): number {
  return deadlineTimestamp(plan.toDate, plan.toTime)
}

export type WeeklyPlanState = 'upcoming' | 'active' | 'ended'

/** WP-8/WD-1..3: a plan is Upcoming before its From moment, Ended at/after its To moment, Active
 *  strictly between the two — never ambiguous, since the two comparisons are mutually exclusive. */
export function weeklyPlanState(plan: Pick<WeeklyPlan, 'fromDate' | 'fromTime' | 'toDate' | 'toTime'>, now: number = Date.now()): WeeklyPlanState {
  const fromAt = weeklyPlanFromTimestamp(plan)
  const toAt = weeklyPlanToTimestamp(plan)
  if (now < fromAt) return 'upcoming'
  if (now >= toAt) return 'ended'
  return 'active'
}

export interface WeeklyPlanValidation {
  valid: boolean
  fieldErrors: { fromDate?: string; fromTime?: string; toDate?: string; toTime?: string }
  generalError?: string
}

/**
 * WP-2/WP-3/WP-6: every one of the four fields is required; the To moment must be strictly after
 * the From moment; and if the plan being edited is currently Active, the new To moment must still
 * be strictly later than now (shortening an active plan's end into the past is always rejected,
 * mirroring DL-6's rule for the daily deadline).
 */
export function validateWeeklyPlanPeriod(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
  options: { isActivePlan?: boolean; now?: number } = {},
): WeeklyPlanValidation {
  const fieldErrors: WeeklyPlanValidation['fieldErrors'] = {}
  if (!fromDate) fieldErrors.fromDate = 'From date is required.'
  if (!fromTime) fieldErrors.fromTime = 'From time is required.'
  if (!toDate) fieldErrors.toDate = 'To date is required.'
  if (!toTime) fieldErrors.toTime = 'To time is required.'
  if (Object.keys(fieldErrors).length > 0) return { valid: false, fieldErrors }

  const fromAt = deadlineTimestamp(fromDate, fromTime)
  const toAt = deadlineTimestamp(toDate, toTime)
  if (toAt <= fromAt) return { valid: false, fieldErrors: {}, generalError: 'End must be after start' }

  const now = options.now ?? Date.now()
  if (options.isActivePlan && toAt <= now) {
    return { valid: false, fieldErrors: {}, generalError: "An active plan's end must be later than now." }
  }
  return { valid: true, fieldErrors: {} }
}

/** WD-2: days, hours, minutes, seconds — unlike the daily deadline's plain HH:MM:SS, a plan's
 *  countdown can span many days. Never negative (WD-5/CT-4-equivalent). */
export function formatWeeklyCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`
}

export type WeeklyDeadlineBarState =
  | { kind: 'upcoming'; startsInMs: number }
  | { kind: CountdownUrgency; remainingMs: number; tasksRemaining: number }
  | { kind: 'success'; remainingMs: number }
  | { kind: 'expired'; tasksRemaining: number }

/** Epic 95: the single source of truth for which Deadline Bar state a plan is in right now —
 *  Upcoming ("Starts in", WD-3), then the same Active/Warning/Success/Expired states as the daily
 *  deadline (lib/deadline.ts's computeDeadlineBarState), just keyed off the plan's own From/To. */
export function computeWeeklyDeadlineBarState<T extends Pick<Task, 'blockedAt' | 'totalSubtasks' | 'completedSubtasks'>>(
  plan: Pick<WeeklyPlan, 'fromDate' | 'fromTime' | 'toDate' | 'toTime'>,
  tasks: T[],
  now: number = Date.now(),
): WeeklyDeadlineBarState {
  const fromAt = weeklyPlanFromTimestamp(plan)
  const toAt = weeklyPlanToTimestamp(plan)
  if (now < fromAt) return { kind: 'upcoming', startsInMs: fromAt - now }
  const tasksRemaining = tasksRemainingCount(tasks)
  if (now >= toAt) return { kind: 'expired', tasksRemaining }
  const remaining = toAt - now
  if (tasksRemaining === 0) return { kind: 'success', remainingMs: remaining }
  return { kind: countdownUrgency(remaining), remainingMs: remaining, tasksRemaining }
}

/** WD-11: freezes a plan's outcome the first time it's observed after ending, from whichever task
 *  state is visible then — never recomputed afterward, mirroring the daily deadline's
 *  frozen-at-first-observation pattern (lib/deadline.ts's ensureDeadlineOutcomeFrozen). */
export async function ensureWeeklyPlanOutcomeFrozen(plan: WeeklyPlan, tasks: Pick<Task, 'blockedAt' | 'totalSubtasks' | 'completedSubtasks'>[]): Promise<WeeklyPlan> {
  if (plan.deadlineOutcome !== undefined) return plan
  if (weeklyPlanState(plan) !== 'ended') return plan
  const outcome: 'met' | 'missed' = tasksRemainingCount(tasks) === 0 ? 'met' : 'missed'
  await db.weeklyPlans.update(plan.id, { deadlineOutcome: outcome })
  return { ...plan, deadlineOutcome: outcome }
}

/** Sweeps every ended plan with an unrecorded outcome and freezes it — run opportunistically (app
 *  load, periodic tick) so the plans list's outcome label (WD-12) stays accurate even for plans the
 *  user never reopens after they end. */
export async function ensureEndedWeeklyPlanOutcomesFrozen(): Promise<void> {
  const plans = await db.weeklyPlans.toArray()
  const pending = plans.filter((p) => p.deadlineOutcome === undefined && weeklyPlanState(p) === 'ended')
  if (pending.length === 0) return
  const allTasks = await db.weeklyTasks.toArray()
  const tasksByPlanId = new Map<string, WeeklyTask[]>()
  for (const task of allTasks) {
    const list = tasksByPlanId.get(task.planId) ?? []
    list.push(task)
    tasksByPlanId.set(task.planId, list)
  }
  for (const plan of pending) {
    await ensureWeeklyPlanOutcomeFrozen(plan, tasksByPlanId.get(plan.id) ?? [])
  }
}

/**
 * WP-11: clones a plan's period and every one of its tasks (including named subtasks), resetting
 * all progress — completedSubtasks to 0, every subtask item's completed to false, and never
 * carrying over Blocked/Rejected state, since a duplicate starts fresh.
 */
export async function duplicateWeeklyPlan(
  plan: WeeklyPlan,
  period: { fromDate: string; fromTime: string; toDate: string; toTime: string },
): Promise<WeeklyPlan> {
  const now = Date.now()
  const newPlan: WeeklyPlan = {
    id: uuid(),
    name: plan.name,
    ...period,
    createdAt: now,
    updatedAt: now,
  }
  await db.weeklyPlans.add(newPlan)

  const tasks = await db.weeklyTasks.where('planId').equals(plan.id).toArray()
  const clones: WeeklyTask[] = tasks.map((task) => ({
    ...task,
    id: uuid(),
    planId: newPlan.id,
    completedSubtasks: 0,
    subtaskItems: task.subtaskItems?.map((item) => ({ ...item, id: uuid(), completed: false })),
    blockedAt: undefined,
    blockedReason: undefined,
    hasBeenBlocked: undefined,
    blockedRejectedAt: undefined,
    createdAt: now,
    updatedAt: now,
  }))
  if (clones.length > 0) await db.weeklyTasks.bulkAdd(clones)

  return newPlan
}
