import { describe, expect, it } from 'vitest'
import { currentStreak, longestStreak } from './streaks'
import { todayKey, addDays } from './date'

describe('streaks', () => {
  it('current streak counts back from today', () => {
    const today = todayKey()
    const dates = new Set([today, addDays(today, -1), addDays(today, -2)])
    expect(currentStreak(dates)).toBe(3)
  })

  it('current streak counts back from yesterday if today has no completion yet', () => {
    const today = todayKey()
    const dates = new Set([addDays(today, -1), addDays(today, -2)])
    expect(currentStreak(dates)).toBe(2)
  })

  it('current streak is 0 with no recent completions', () => {
    const today = todayKey()
    const dates = new Set([addDays(today, -5)])
    expect(currentStreak(dates)).toBe(0)
  })

  it('longest streak finds the best run in history', () => {
    const dates = new Set(['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-10'])
    expect(longestStreak(dates)).toBe(3)
  })

  it('longest streak is 0 for no data', () => {
    expect(longestStreak(new Set())).toBe(0)
  })
})
