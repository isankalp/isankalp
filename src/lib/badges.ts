import { db } from '../db/db'
import { minutesDone as taskMinutesDone } from '../db/models'
import { completedDateKeys, longestStreak } from './streaks'

export const STREAK_MILESTONES = [10, 30, 100]
export const MINUTES_HOUR_MILESTONES = [100, 500]

function streakBadgeId(milestone: number): string {
  return `streak-${milestone}`
}

function minutesBadgeId(hours: number): string {
  return `minutes-${hours}`
}

export function badgeLabel(type: 'streak' | 'minutes', milestone: number): string {
  return type === 'streak' ? `${milestone}-day streak` : `${milestone} hours logged`
}

/** Awards any newly-earned badges. Safe to call on every app load — never re-awards or duplicates. */
export async function checkAndAwardBadges(): Promise<void> {
  const [days, tasks] = await Promise.all([db.days.toArray(), db.tasks.toArray()])

  const completedDates = completedDateKeys(days, tasks)
  const bestStreak = longestStreak(completedDates)
  const cumulativeMinutes = tasks.reduce((sum, t) => sum + taskMinutesDone(t), 0)

  for (const milestone of STREAK_MILESTONES) {
    if (bestStreak < milestone) continue
    const id = streakBadgeId(milestone)
    const existing = await db.badges.get(id)
    if (existing) continue
    await db.badges.add({ id, type: 'streak', milestone, earnedAt: Date.now() })
  }

  for (const hours of MINUTES_HOUR_MILESTONES) {
    if (cumulativeMinutes < hours * 60) continue
    const id = minutesBadgeId(hours)
    const existing = await db.badges.get(id)
    if (existing) continue
    await db.badges.add({ id, type: 'minutes', milestone: hours, earnedAt: Date.now() })
  }
}
