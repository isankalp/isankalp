import { db } from '../db/db'
import { isTaskBlocked, isTaskComplete, type Day, type Task } from '../db/models'
import { parseDateKey, todayKey } from './date'

/** CT-5 escalation thresholds — "Should", not user-configurable via Settings, but kept as named
 *  constants (and accepted as optional overrides below) rather than magic numbers. */
export const WARNING_THRESHOLD_MS = 30 * 60 * 1000
export const CRITICAL_THRESHOLD_MS = 10 * 60 * 1000

/** Combines a YYYY-MM-DD date key with an "HH:MM" 24h local time into an epoch timestamp. */
export function deadlineTimestamp(date: string, time: string): number {
  const d = parseDateKey(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** DL-3/DL-6: today's deadline must be strictly later than now, whether being set for the first
 *  time or edited/shortened. DL-4: a future day's deadline has no such check — it isn't live yet. */
export function canSaveDeadline(date: string, time: string, now: number = Date.now()): boolean {
  const today = todayKey()
  if (date < today) return false
  if (date > today) return true
  return deadlineTimestamp(date, time) > now
}

/** DI-4/WD-7: Blocked tasks are never counted, on top of the usual "not yet at 100%" filter.
 *  Pick-typed so it's directly reusable for WeeklyTask (v17), which shares these fields. */
export function tasksRemainingCount(tasks: Pick<Task, 'blockedAt' | 'totalSubtasks' | 'completedSubtasks'>[]): number {
  return tasks.filter((t) => !isTaskBlocked(t) && !isTaskComplete(t)).length
}

/** CT-4: never negative — clamps to zero once the deadline has passed. */
export function remainingMs(deadlineAt: number, now: number = Date.now()): number {
  return Math.max(0, deadlineAt - now)
}

/** CT-1: HH:MM:SS, always non-negative (CT-4). */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export type CountdownUrgency = 'active' | 'warning' | 'critical'

/** CT-5: amber under warningThresholdMs, red under criticalThresholdMs — both color and (in the
 *  component) an icon, never color alone. */
export function countdownUrgency(
  msRemaining: number,
  warningThresholdMs: number = WARNING_THRESHOLD_MS,
  criticalThresholdMs: number = CRITICAL_THRESHOLD_MS,
): CountdownUrgency {
  if (msRemaining <= criticalThresholdMs) return 'critical'
  if (msRemaining <= warningThresholdMs) return 'warning'
  return 'active'
}

export type DeadlineBarState =
  | { kind: 'empty' }
  | { kind: CountdownUrgency; remainingMs: number; tasksRemaining: number }
  | { kind: 'success'; remainingMs: number }
  | { kind: 'expired'; tasksRemaining: number }

/** Epics 83-85: the single source of truth for which of the Deadline Bar's four named states (plus
 *  the CT-5 warning/critical split of Active, and the no-deadline empty state) applies right now.
 *  Pure and side-effect-free so the Tasks tab, Dashboard widget, and Focus Timer overlay (DI-6) can
 *  all derive the same live state from the same (day, tasks, now) without duplicating logic. */
export function computeDeadlineBarState(
  day: Pick<Day, 'date' | 'deadlineTime'>,
  tasks: Task[],
  now: number = Date.now(),
): DeadlineBarState {
  if (!day.deadlineTime) return { kind: 'empty' }
  const deadlineAt = deadlineTimestamp(day.date, day.deadlineTime)
  const tasksRemaining = tasksRemainingCount(tasks)
  if (now >= deadlineAt) return { kind: 'expired', tasksRemaining }
  const remaining = deadlineAt - now
  if (tasksRemaining === 0) return { kind: 'success', remainingMs: remaining }
  return { kind: countdownUrgency(remaining), remainingMs: remaining, tasksRemaining }
}

/**
 * DE-4/DE-5: freezes a past day's deadline outcome the first time it's observed after that day has
 * ended, from whatever task state is visible at that moment — then never touches it again, so a
 * task completed afterward (DE-2 allows this freely) can never flip a recorded "missed" back to
 * "met". Mirrors the hasBeenBlocked "frozen at first observation" pattern from Epic 79. A no-op for
 * today/future days (nothing to freeze yet) or days with no deadline or an already-recorded outcome.
 */
export async function ensureDeadlineOutcomeFrozen(day: Day, tasks: Task[]): Promise<Day> {
  if (day.deadlineOutcome !== undefined) return day
  if (!day.deadlineTime) return day
  if (day.date >= todayKey()) return day
  const outcome: 'met' | 'missed' = tasksRemainingCount(tasks) === 0 ? 'met' : 'missed'
  await db.days.update(day.id, { deadlineOutcome: outcome })
  return { ...day, deadlineOutcome: outcome }
}

/** Sweeps every past day with an unrecorded deadline outcome and freezes it — run opportunistically
 *  (app load, periodic tick) so DI-5's Calendar marker and DE-6's history are accurate even for days
 *  the user never reopens individually after their deadline passes. */
export async function ensurePastDeadlineOutcomesFrozen(): Promise<void> {
  const today = todayKey()
  const days = await db.days.toArray()
  const pending = days.filter((d) => d.deadlineTime && d.deadlineOutcome === undefined && d.date < today)
  if (pending.length === 0) return
  const allTasks = await db.tasks.toArray()
  const tasksByDayId = new Map<string, Task[]>()
  for (const task of allTasks) {
    const list = tasksByDayId.get(task.dayId) ?? []
    list.push(task)
    tasksByDayId.set(task.dayId, list)
  }
  for (const day of pending) {
    await ensureDeadlineOutcomeFrozen(day, tasksByDayId.get(day.id) ?? [])
  }
}
