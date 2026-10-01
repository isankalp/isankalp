import { db, getOrCreateDay, updateTaskTracked } from '../db/db'
import { isTaskBlocked, isTaskComplete, type Day, type Task } from '../db/models'
import { daysBetween, todayKey } from './date'

/** BK-5/BK-1: only an Active (not already Blocked, not already complete) task can be marked Blocked. */
export function canMarkBlocked(task: Task): boolean {
  return !isTaskBlocked(task) && !isTaskComplete(task)
}

/** BK-3: Unblock is only offered while the task is still sitting on today's day — once a day boundary
 *  passes, resolving it moves to the carryover queue's Accept/Reject instead. */
export function canUnblockToday(task: Task, day: Pick<Day, 'date'>): boolean {
  return isTaskBlocked(task) && day.date === todayKey()
}

/**
 * CQ-1/CQ-2/RA-3: a task belongs in today's carryover queue if it has ever been Blocked, hasn't been
 * permanently Rejected, isn't already complete, and is currently sitting on a day that's now in the
 * past — whether because it's still literally Blocked there, or because it was Accepted onto that day
 * and never finished (which resurfaces it automatically, with no need to re-mark it Blocked).
 */
export function isCarryoverCandidate(task: Task, day: Pick<Day, 'date'>): boolean {
  if (!task.hasBeenBlocked) return false
  if (task.blockedRejectedAt !== undefined) return false
  if (isTaskComplete(task)) return false
  return day.date < todayKey()
}

/** CQ-3: "Blocked N days ago", measured from the day it's currently stuck on, not blockedAt itself —
 *  so it reads the same whether the item is still literally Blocked or was Accepted and left unfinished. */
export function daysBlocked(day: Pick<Day, 'date'>): number {
  return Math.max(0, daysBetween(day.date, todayKey()))
}

/** RA-1/RA-2: moves the task onto today's Day, preserving completedSubtasks/totalSubtasks, and clears
 *  the Blocked badge/state — it's now a normal Active task for today. hasBeenBlocked stays true so
 *  RA-3's automatic re-carryover keeps working if it's still incomplete tomorrow. */
export async function acceptBlockedTask(task: Task): Promise<void> {
  const today = await getOrCreateDay(todayKey())
  await updateTaskTracked(task, { dayId: today.id, blockedAt: undefined, blockedReason: undefined })
}

/** RA-4/RA-6: permanently excludes the task from every future carryover queue without deleting it —
 *  its full history (including this rejection) stays viewable. */
export async function rejectBlockedTask(task: Task): Promise<void> {
  await updateTaskTracked(task, { blockedRejectedAt: Date.now(), blockedAt: undefined })
}

export interface CarryoverItem {
  task: Task
  day: Day
}

/** Loads every unresolved carryover candidate across all days, oldest-blocked first (CQ-3). */
export async function getCarryoverQueue(): Promise<CarryoverItem[]> {
  const [tasks, days] = await Promise.all([db.tasks.toArray(), db.days.toArray()])
  const dayById = new Map(days.map((d) => [d.id, d]))
  const items: CarryoverItem[] = []
  for (const task of tasks) {
    const day = dayById.get(task.dayId)
    if (!day) continue
    if (isCarryoverCandidate(task, day)) items.push({ task, day })
  }
  return items.sort((a, b) => a.day.date.localeCompare(b.day.date))
}
