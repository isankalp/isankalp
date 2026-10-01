import { describe, expect, it } from 'vitest'
import type { Day, Task } from '../db/models'
import { addDays, todayKey } from './date'
import { canMarkBlocked, canUnblockToday, daysBlocked, isCarryoverCandidate } from './blocked'

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

function makeDay(date: string): Day {
  return { id: `day-${date}`, date }
}

describe('canMarkBlocked (BK-1/BK-5)', () => {
  it('allows an Active, incomplete task', () => {
    expect(canMarkBlocked(makeTask())).toBe(true)
  })

  it('refuses a task already at 100% completion', () => {
    expect(canMarkBlocked(makeTask({ totalSubtasks: 5, completedSubtasks: 5 }))).toBe(false)
  })

  it('refuses a task that is already Blocked', () => {
    expect(canMarkBlocked(makeTask({ blockedAt: Date.now() }))).toBe(false)
  })
})

describe('canUnblockToday (BK-3)', () => {
  it('allows unblocking a Blocked task still sitting on today', () => {
    const task = makeTask({ blockedAt: Date.now() })
    expect(canUnblockToday(task, makeDay(todayKey()))).toBe(true)
  })

  it('refuses once the task is sitting on a past day', () => {
    const task = makeTask({ blockedAt: Date.now() })
    expect(canUnblockToday(task, makeDay(addDays(todayKey(), -1)))).toBe(false)
  })

  it('refuses a task that is not Blocked at all', () => {
    expect(canUnblockToday(makeTask(), makeDay(todayKey()))).toBe(false)
  })
})

describe('isCarryoverCandidate (CQ-1/CQ-2/RA-3)', () => {
  const yesterday = addDays(todayKey(), -1)

  it('surfaces a still-Blocked task left over from a past day', () => {
    const task = makeTask({ hasBeenBlocked: true, blockedAt: Date.now() })
    expect(isCarryoverCandidate(task, makeDay(yesterday))).toBe(true)
  })

  it('surfaces an Accepted-but-unfinished task automatically, with no re-mark needed (RA-3)', () => {
    const task = makeTask({ hasBeenBlocked: true, blockedAt: undefined, completedSubtasks: 2, totalSubtasks: 5 })
    expect(isCarryoverCandidate(task, makeDay(yesterday))).toBe(true)
  })

  it('excludes a task that was never Blocked', () => {
    const task = makeTask({ hasBeenBlocked: undefined })
    expect(isCarryoverCandidate(task, makeDay(yesterday))).toBe(false)
  })

  it('excludes a task that has since been completed (CQ-2)', () => {
    const task = makeTask({ hasBeenBlocked: true, totalSubtasks: 5, completedSubtasks: 5 })
    expect(isCarryoverCandidate(task, makeDay(yesterday))).toBe(false)
  })

  it('excludes a permanently Rejected task (RA-4)', () => {
    const task = makeTask({ hasBeenBlocked: true, blockedRejectedAt: Date.now() })
    expect(isCarryoverCandidate(task, makeDay(yesterday))).toBe(false)
  })

  it('excludes a task still sitting on today (not yet carried over)', () => {
    const task = makeTask({ hasBeenBlocked: true, blockedAt: Date.now() })
    expect(isCarryoverCandidate(task, makeDay(todayKey()))).toBe(false)
  })
})

describe('daysBlocked (CQ-3)', () => {
  it('counts whole days between the day it is stuck on and today', () => {
    expect(daysBlocked(makeDay(addDays(todayKey(), -3)))).toBe(3)
    expect(daysBlocked(makeDay(addDays(todayKey(), -1)))).toBe(1)
  })

  it('never goes negative for a same-day item', () => {
    expect(daysBlocked(makeDay(todayKey()))).toBe(0)
  })
})
