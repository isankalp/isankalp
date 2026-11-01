import { describe, expect, it } from 'vitest'
import type { Day, Task } from '../db/models'
import { addDays, todayKey } from './date'
import {
  canSaveDeadline,
  computeDeadlineBarState,
  countdownUrgency,
  deadlineTimestamp,
  formatCountdown,
  remainingMs,
  tasksRemainingCount,
} from './deadline'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Solve 5 questions',
    dayId: 'd1',
    minutesPerSubtask: 5,
    totalSubtasks: 5,
    completedSubtasks: 2,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('deadlineTimestamp', () => {
  it('combines date + HH:MM into the matching local timestamp', () => {
    const ts = deadlineTimestamp('2026-11-01', '18:30')
    const d = new Date(ts)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(30)
  })
})

describe('canSaveDeadline (DL-3/DL-4/DL-6)', () => {
  it('rejects a today deadline at or before the current time', () => {
    const today = todayKey()
    const now = deadlineTimestamp(today, '12:00')
    expect(canSaveDeadline(today, '12:00', now)).toBe(false)
    expect(canSaveDeadline(today, '11:59', now)).toBe(false)
  })

  it('allows a today deadline strictly later than now', () => {
    const today = todayKey()
    const now = deadlineTimestamp(today, '12:00')
    expect(canSaveDeadline(today, '12:01', now)).toBe(true)
  })

  it('allows any time on a future day regardless of current time', () => {
    const future = addDays(todayKey(), 3)
    expect(canSaveDeadline(future, '00:01')).toBe(true)
  })

  it('rejects setting a deadline on a day already in the past', () => {
    const past = addDays(todayKey(), -1)
    expect(canSaveDeadline(past, '23:59')).toBe(false)
  })
})

describe('remainingMs / formatCountdown (CT-1/CT-4)', () => {
  it('never goes negative once the deadline has passed', () => {
    expect(remainingMs(1000, 5000)).toBe(0)
  })

  it('formats HH:MM:SS, zero-padded', () => {
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(5000)).toBe('00:00:05')
    expect(formatCountdown(61 * 1000)).toBe('00:01:01')
    expect(formatCountdown((2 * 3600 + 3 * 60 + 4) * 1000)).toBe('02:03:04')
  })
})

describe('countdownUrgency (CT-5)', () => {
  it('is active above the warning threshold', () => {
    expect(countdownUrgency(31 * 60 * 1000)).toBe('active')
  })

  it('is warning at/under 30 minutes but above 10', () => {
    expect(countdownUrgency(30 * 60 * 1000)).toBe('warning')
    expect(countdownUrgency(11 * 60 * 1000)).toBe('warning')
  })

  it('is critical at/under 10 minutes', () => {
    expect(countdownUrgency(10 * 60 * 1000)).toBe('critical')
    expect(countdownUrgency(0)).toBe('critical')
  })
})

describe('tasksRemainingCount (DI-4)', () => {
  it('excludes completed and Blocked tasks', () => {
    const tasks = [
      makeTask({ id: 'a', completedSubtasks: 5, totalSubtasks: 5 }),
      makeTask({ id: 'b', blockedAt: Date.now() }),
      makeTask({ id: 'c', completedSubtasks: 1, totalSubtasks: 5 }),
    ]
    expect(tasksRemainingCount(tasks)).toBe(1)
  })
})

describe('computeDeadlineBarState', () => {
  const day: Pick<Day, 'date' | 'deadlineTime'> = { date: '2026-11-01', deadlineTime: '18:00' }

  it('is empty when the day has no deadline (DL-2/CT-8)', () => {
    expect(computeDeadlineBarState({ date: '2026-11-01' }, [])).toEqual({ kind: 'empty' })
  })

  it('is success when all non-blocked tasks are done before the deadline (CT-7)', () => {
    const now = deadlineTimestamp('2026-11-01', '10:00')
    const tasks = [makeTask({ completedSubtasks: 5, totalSubtasks: 5 })]
    const state = computeDeadlineBarState(day, tasks, now)
    expect(state.kind).toBe('success')
  })

  it('is active/warning/critical with tasks remaining before the deadline', () => {
    const now = deadlineTimestamp('2026-11-01', '17:55')
    const tasks = [makeTask()]
    const state = computeDeadlineBarState(day, tasks, now)
    expect(state.kind).toBe('critical')
    if (state.kind === 'critical') expect(state.tasksRemaining).toBe(1)
  })

  it('is expired once the deadline passes with tasks still incomplete (DE-1)', () => {
    const now = deadlineTimestamp('2026-11-01', '18:01')
    const tasks = [makeTask()]
    const state = computeDeadlineBarState(day, tasks, now)
    expect(state).toEqual({ kind: 'expired', tasksRemaining: 1 })
  })

  it('never counts below zero / never goes past 00:00:00 (CT-4)', () => {
    const now = deadlineTimestamp('2026-11-01', '19:00')
    const state = computeDeadlineBarState(day, [], now)
    expect(state.kind).toBe('expired')
  })
})
