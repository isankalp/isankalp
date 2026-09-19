import { describe, expect, it } from 'vitest'
import { badgeLabel, MINUTES_HOUR_MILESTONES, STREAK_MILESTONES } from './badges'

describe('badge labels', () => {
  it('describes a streak badge in days', () => {
    expect(badgeLabel('streak', 10)).toBe('10-day streak')
  })

  it('describes a minutes badge in hours', () => {
    expect(badgeLabel('minutes', 100)).toBe('100 hours logged')
  })

  it('milestones are defined in ascending order', () => {
    expect(STREAK_MILESTONES).toEqual([...STREAK_MILESTONES].sort((a, b) => a - b))
    expect(MINUTES_HOUR_MILESTONES).toEqual([...MINUTES_HOUR_MILESTONES].sort((a, b) => a - b))
  })
})
