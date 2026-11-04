import { isTaskComplete, type Day, type Task } from '../db/models'
import { addDays, todayKey } from './date'

/** Given all days/tasks, compute the set of date keys that had >=1 completed task. */
export function completedDateKeys(days: Day[], tasks: Task[]): Set<string> {
  const dayById = new Map(days.map((d) => [d.id, d.date]))
  const completed = new Set<string>()
  for (const task of tasks) {
    if (isTaskComplete(task)) {
      const date = dayById.get(task.dayId)
      if (date) completed.add(date)
    }
  }
  return completed
}

export function currentStreak(completedDates: Set<string>): number {
  let streak = 0
  let cursor = todayKey()
  // Today doesn't need to be complete yet to keep yesterday's streak alive while the day is in progress,
  // but if today has no completions we start counting from yesterday.
  if (!completedDates.has(cursor)) {
    cursor = addDays(cursor, -1)
  }
  while (completedDates.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** AI-3: the most recent date with a completed task, used to find where a broken streak stopped. */
export function lastCompletedDate(completedDates: Set<string>): string | null {
  if (completedDates.size === 0) return null
  return [...completedDates].sort().at(-1) ?? null
}

export function longestStreak(completedDates: Set<string>): number {
  if (completedDates.size === 0) return 0
  const sorted = [...completedDates].sort()
  let longest = 1
  let running = 1
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) {
      running++
    } else {
      running = 1
    }
    longest = Math.max(longest, running)
  }
  return longest
}
