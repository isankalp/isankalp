import { describe, expect, it } from 'vitest'
import type { Task, WeeklyPlan } from '../db/models'
import {
  computeWeeklyDeadlineBarState,
  formatWeeklyCountdown,
  validateWeeklyPlanPeriod,
  weeklyPlanDisplayName,
  weeklyPlanFromTimestamp,
  weeklyPlanState,
  weeklyPlanToTimestamp,
} from './weekly'

function makePlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: 'p1',
    name: '',
    fromDate: '2026-11-02',
    fromTime: '09:00',
    toDate: '2026-11-09',
    toTime: '18:00',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dayId: 'd1',
    minutesPerSubtask: 5,
    totalSubtasks: 5,
    completedSubtasks: 0,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('weeklyPlanDisplayName (WP-4)', () => {
  it('uses the given name when set', () => {
    expect(weeklyPlanDisplayName(makePlan({ name: 'Sprint 1' }))).toBe('Sprint 1')
  })

  it('defaults to "Week of [From date]" when empty', () => {
    expect(weeklyPlanDisplayName(makePlan({ name: '', fromDate: '2026-11-02' }))).toBe('Week of 2026-11-02')
  })

  it('treats whitespace-only names as empty', () => {
    expect(weeklyPlanDisplayName(makePlan({ name: '   ' }))).toBe('Week of 2026-11-02')
  })
})

describe('weeklyPlanFromTimestamp/ToTimestamp', () => {
  it('combines date + time into the matching local timestamp', () => {
    const ts = weeklyPlanFromTimestamp(makePlan({ fromDate: '2026-11-02', fromTime: '09:30' }))
    const d = new Date(ts)
    expect(d.getHours()).toBe(9)
    expect(d.getMinutes()).toBe(30)
  })
})

describe('weeklyPlanState (WP-8/WD-1..3)', () => {
  const plan = makePlan({ fromDate: '2026-11-02', fromTime: '09:00', toDate: '2026-11-09', toTime: '18:00' })

  it('is upcoming before the From moment', () => {
    const now = weeklyPlanFromTimestamp(plan) - 1000
    expect(weeklyPlanState(plan, now)).toBe('upcoming')
  })

  it('is active strictly between From and To', () => {
    const now = weeklyPlanFromTimestamp(plan) + 1000
    expect(weeklyPlanState(plan, now)).toBe('active')
  })

  it('is ended at or after the To moment', () => {
    expect(weeklyPlanState(plan, weeklyPlanToTimestamp(plan))).toBe('ended')
    expect(weeklyPlanState(plan, weeklyPlanToTimestamp(plan) + 1000)).toBe('ended')
  })
})

describe('validateWeeklyPlanPeriod (WP-2/WP-3/WP-6)', () => {
  it('requires all four fields', () => {
    const result = validateWeeklyPlanPeriod('', '', '2026-11-09', '18:00')
    expect(result.valid).toBe(false)
    expect(result.fieldErrors.fromDate).toBeTruthy()
    expect(result.fieldErrors.fromTime).toBeTruthy()
    expect(result.fieldErrors.toDate).toBeUndefined()
  })

  it('rejects an end at or before the start', () => {
    const atStart = validateWeeklyPlanPeriod('2026-11-02', '09:00', '2026-11-02', '09:00')
    expect(atStart.valid).toBe(false)
    expect(atStart.generalError).toBe('End must be after start')

    const beforeStart = validateWeeklyPlanPeriod('2026-11-02', '09:00', '2026-11-01', '09:00')
    expect(beforeStart.valid).toBe(false)
  })

  it('accepts a valid period', () => {
    expect(validateWeeklyPlanPeriod('2026-11-02', '09:00', '2026-11-09', '18:00').valid).toBe(true)
  })

  it('rejects moving an active plan\'s end to now or earlier', () => {
    const now = deadlineTimestampFor('2026-11-05', '12:00')
    const result = validateWeeklyPlanPeriod('2026-11-02', '09:00', '2026-11-05', '12:00', { isActivePlan: true, now })
    expect(result.valid).toBe(false)
    expect(result.generalError).toMatch(/later than now/)
  })

  it('allows moving an active plan\'s end to a moment still in the future', () => {
    const now = deadlineTimestampFor('2026-11-05', '12:00')
    const result = validateWeeklyPlanPeriod('2026-11-02', '09:00', '2026-11-05', '12:01', { isActivePlan: true, now })
    expect(result.valid).toBe(true)
  })

  it('does not apply the active-plan rule to an upcoming or ended plan', () => {
    const now = deadlineTimestampFor('2026-11-05', '12:00')
    const result = validateWeeklyPlanPeriod('2026-11-02', '09:00', '2026-11-04', '00:00', { isActivePlan: false, now })
    expect(result.valid).toBe(true)
  })
})

function deadlineTimestampFor(date: string, time: string): number {
  return weeklyPlanFromTimestamp({ fromDate: date, fromTime: time })
}

describe('formatWeeklyCountdown (WD-2/WD-5)', () => {
  it('formats under a day as plain HH:MM:SS', () => {
    expect(formatWeeklyCountdown((2 * 3600 + 3 * 60 + 4) * 1000)).toBe('02:03:04')
  })

  it('prefixes days when present', () => {
    expect(formatWeeklyCountdown((3 * 86400 + 5 * 3600 + 12 * 60 + 8) * 1000)).toBe('3d 05:12:08')
  })

  it('never goes negative', () => {
    expect(formatWeeklyCountdown(-5000)).toBe('00:00:00')
  })
})

describe('computeWeeklyDeadlineBarState (Epic 95)', () => {
  const plan = makePlan({ fromDate: '2026-11-02', fromTime: '09:00', toDate: '2026-11-09', toTime: '18:00' })

  it('is upcoming before From, with a startsInMs duration', () => {
    const now = weeklyPlanFromTimestamp(plan) - 60_000
    const state = computeWeeklyDeadlineBarState(plan, [makeTask()], now)
    expect(state.kind).toBe('upcoming')
    if (state.kind === 'upcoming') expect(state.startsInMs).toBe(60_000)
  })

  it('is active with tasks remaining between From and To', () => {
    const now = weeklyPlanFromTimestamp(plan) + 60_000
    const state = computeWeeklyDeadlineBarState(plan, [makeTask()], now)
    expect(state.kind).toBe('active')
  })

  it('is success when all non-blocked tasks are done before To', () => {
    const now = weeklyPlanFromTimestamp(plan) + 60_000
    const state = computeWeeklyDeadlineBarState(plan, [makeTask({ completedSubtasks: 5 })], now)
    expect(state.kind).toBe('success')
  })

  it('is expired once To passes with tasks still incomplete', () => {
    const now = weeklyPlanToTimestamp(plan) + 1000
    const state = computeWeeklyDeadlineBarState(plan, [makeTask()], now)
    expect(state).toEqual({ kind: 'expired', tasksRemaining: 1 })
  })

  it('never counts blocked tasks toward tasksRemaining', () => {
    const now = weeklyPlanFromTimestamp(plan) + 60_000
    const state = computeWeeklyDeadlineBarState(plan, [makeTask({ blockedAt: 1 })], now)
    expect(state.kind).toBe('success')
  })
})
