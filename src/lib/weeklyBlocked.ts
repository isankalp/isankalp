import { db } from '../db/db'
import { isTaskBlocked, isTaskComplete, type WeeklyPlan, type WeeklyTask } from '../db/models'
import { weeklyPlanFromTimestamp, weeklyPlanState, weeklyPlanToTimestamp } from './weekly'

export { canMarkBlocked as canMarkWeeklyTaskBlocked } from './blocked'

/** WB-5: Unblock is only offered while the task's own plan hasn't ended yet — once it has, resolving
 *  it moves to the next plan's carryover queue's Accept/Reject instead (mirrors BK-3's same-day rule). */
export function canUnblockWeeklyTask(task: Pick<WeeklyTask, 'blockedAt'>, plan: WeeklyPlan, now: number = Date.now()): boolean {
  return isTaskBlocked(task) && weeklyPlanState(plan, now) !== 'ended'
}

/**
 * WB-6/WB-8: a weekly task belongs in its plan's carryover queue if it has ever been Blocked,
 * hasn't been permanently Rejected, isn't already complete, and its own plan has ended — whether
 * because it's still literally Blocked there, or was Accepted onto that plan and never finished
 * (which resurfaces it automatically, mirroring RA-3's daily rule).
 */
export function isWeeklyCarryoverCandidate(task: WeeklyTask, plan: WeeklyPlan, now: number = Date.now()): boolean {
  if (!task.hasBeenBlocked) return false
  if (task.blockedRejectedAt !== undefined) return false
  if (isTaskComplete(task)) return false
  return weeklyPlanState(plan, now) === 'ended'
}

/** "Blocked N days ago", measured from when the task's own plan ended, not blockedAt itself — reads
 *  the same whether the item is still literally Blocked or was Accepted and left unfinished. */
export function weeklyDaysBlocked(plan: Pick<WeeklyPlan, 'toDate' | 'toTime'>, now: number = Date.now()): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((now - weeklyPlanToTimestamp(plan)) / msPerDay))
}

/**
 * WB-6: finds, among every OTHER plan that starts before `plan`, the one with the latest From
 * moment that has also ended — i.e. the plan immediately preceding `plan` in start-date order. A
 * plan's carryover queue is scoped to exactly this one preceding plan, mirroring how daily's
 * carryover is scoped to "yesterday and earlier" relative to today.
 */
export function findPrecedingEndedPlan(plan: WeeklyPlan, allPlans: WeeklyPlan[], now: number = Date.now()): WeeklyPlan | undefined {
  const planFromAt = weeklyPlanFromTimestamp(plan)
  let best: WeeklyPlan | undefined
  let bestFromAt = -Infinity
  for (const candidate of allPlans) {
    if (candidate.id === plan.id) continue
    const candidateFromAt = weeklyPlanFromTimestamp(candidate)
    if (candidateFromAt >= planFromAt) continue
    if (weeklyPlanState(candidate, now) !== 'ended') continue
    if (candidateFromAt > bestFromAt) {
      best = candidate
      bestFromAt = candidateFromAt
    }
  }
  return best
}

export interface WeeklyCarryoverItem {
  task: WeeklyTask
  /** The preceding ended plan the task currently still belongs to. */
  plan: WeeklyPlan
}

/** WB-6/WB-10: the unresolved carryover queue for one specific plan being opened — empty (so the
 *  panel doesn't render) unless a preceding-by-start-date plan has ended with unresolved items. */
export async function getWeeklyCarryoverQueueForPlan(plan: WeeklyPlan, now: number = Date.now()): Promise<WeeklyCarryoverItem[]> {
  const allPlans = await db.weeklyPlans.toArray()
  const precedingPlan = findPrecedingEndedPlan(plan, allPlans, now)
  if (!precedingPlan) return []
  const tasks = await db.weeklyTasks.where('planId').equals(precedingPlan.id).toArray()
  return tasks
    .filter((task) => isWeeklyCarryoverCandidate(task, precedingPlan, now))
    .map((task) => ({ task, plan: precedingPlan }))
    .sort((a, b) => (a.task.blockedAt ?? a.task.createdAt) - (b.task.blockedAt ?? b.task.createdAt))
}

/** WB-7: moves the task onto the CURRENT plan being viewed, preserving completedSubtasks/totalSubtasks,
 *  and clears the Blocked state — hasBeenBlocked stays true so WB-8's automatic re-carryover keeps
 *  working if it's still incomplete when this plan itself ends. */
export async function acceptWeeklyBlockedTask(task: WeeklyTask, targetPlanId: string): Promise<void> {
  await db.weeklyTasks.update(task.id, { planId: targetPlanId, blockedAt: undefined, blockedReason: undefined, updatedAt: Date.now() })
}

/** WB-9: permanently excludes the task from every future carryover queue without deleting it — its
 *  full history (including this rejection) stays viewable. */
export async function rejectWeeklyBlockedTask(task: WeeklyTask): Promise<void> {
  await db.weeklyTasks.update(task.id, { blockedRejectedAt: Date.now(), blockedAt: undefined, updatedAt: Date.now() })
}
