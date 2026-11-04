import { describe, expect, it } from 'vitest'
import type { WeeklyPlan, WeeklyTask } from '../db/models'
import {
  canMarkWeeklyTaskBlocked,
  canUnblockWeeklyTask,
  findPrecedingEndedPlan,
  isWeeklyCarryoverCandidate,
  weeklyDaysBlocked,
} from './weeklyBlocked'

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

function makeTask(overrides: Partial<WeeklyTask> = {}): WeeklyTask {
  return {
    id: 't1',
    title: 'Task',
    planId: 'p1',
    minutesPerSubtask: 5,
    totalSubtasks: 5,
    completedSubtasks: 0,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('canMarkWeeklyTaskBlocked (WB-1/WB-4)', () => {
  it('allows an Active, incomplete task', () => {
    expect(canMarkWeeklyTaskBlocked(makeTask())).toBe(true)
  })

  it('refuses a task already at 100%', () => {
    expect(canMarkWeeklyTaskBlocked(makeTask({ totalSubtasks: 5, completedSubtasks: 5 }))).toBe(false)
  })

  it('refuses an already-Blocked task', () => {
    expect(canMarkWeeklyTaskBlocked(makeTask({ blockedAt: Date.now() }))).toBe(false)
  })
})

describe('canUnblockWeeklyTask (WB-5)', () => {
  const plan = makePlan({ fromDate: '2026-11-02', fromTime: '09:00', toDate: '2026-11-09', toTime: '18:00' })

  it('allows unblocking while the plan has not ended', () => {
    const now = new Date(2026, 10, 5).getTime()
    expect(canUnblockWeeklyTask(makeTask({ blockedAt: 1 }), plan, now)).toBe(true)
  })

  it('refuses once the plan has ended', () => {
    const now = new Date(2026, 10, 10).getTime()
    expect(canUnblockWeeklyTask(makeTask({ blockedAt: 1 }), plan, now)).toBe(false)
  })

  it('refuses a task that is not Blocked', () => {
    const now = new Date(2026, 10, 5).getTime()
    expect(canUnblockWeeklyTask(makeTask(), plan, now)).toBe(false)
  })
})

describe('isWeeklyCarryoverCandidate (WB-6/WB-8)', () => {
  const endedPlan = makePlan({ fromDate: '2026-10-26', fromTime: '09:00', toDate: '2026-11-02', toTime: '09:00' })
  const now = new Date(2026, 10, 5).getTime()

  it('is a candidate once its plan has ended, still Blocked, never rejected, never complete', () => {
    const task = makeTask({ hasBeenBlocked: true, blockedAt: 1 })
    expect(isWeeklyCarryoverCandidate(task, endedPlan, now)).toBe(true)
  })

  it('is also a candidate when Accepted but left incomplete (no blockedAt, hasBeenBlocked true)', () => {
    const task = makeTask({ hasBeenBlocked: true })
    expect(isWeeklyCarryoverCandidate(task, endedPlan, now)).toBe(true)
  })

  it('is never a candidate once Rejected', () => {
    const task = makeTask({ hasBeenBlocked: true, blockedRejectedAt: 1 })
    expect(isWeeklyCarryoverCandidate(task, endedPlan, now)).toBe(false)
  })

  it('is never a candidate once complete', () => {
    const task = makeTask({ hasBeenBlocked: true, totalSubtasks: 5, completedSubtasks: 5 })
    expect(isWeeklyCarryoverCandidate(task, endedPlan, now)).toBe(false)
  })

  it('is never a candidate while its plan is still active', () => {
    const activePlan = makePlan({ fromDate: '2026-11-02', fromTime: '09:00', toDate: '2026-11-09', toTime: '18:00' })
    const task = makeTask({ hasBeenBlocked: true, blockedAt: 1 })
    expect(isWeeklyCarryoverCandidate(task, activePlan, now)).toBe(false)
  })

  it('is never a candidate for a task that was never Blocked', () => {
    expect(isWeeklyCarryoverCandidate(makeTask(), endedPlan, now)).toBe(false)
  })
})

describe('weeklyDaysBlocked', () => {
  it('counts whole days since the plan ended', () => {
    const plan = makePlan({ toDate: '2026-11-02', toTime: '09:00' })
    const now = new Date(2026, 10, 5, 9, 0).getTime()
    expect(weeklyDaysBlocked(plan, now)).toBe(3)
  })

  it('never goes negative for a plan that has not ended yet', () => {
    const plan = makePlan({ toDate: '2026-11-09', toTime: '18:00' })
    const now = new Date(2026, 10, 5).getTime()
    expect(weeklyDaysBlocked(plan, now)).toBe(0)
  })
})

describe('findPrecedingEndedPlan (WB-6)', () => {
  it('finds the immediately-preceding-by-start-date plan once it has ended', () => {
    const now = new Date(2026, 10, 20).getTime()
    const earliest = makePlan({ id: 'a', fromDate: '2026-10-01', fromTime: '09:00', toDate: '2026-10-08', toTime: '09:00' })
    const middle = makePlan({ id: 'b', fromDate: '2026-10-15', fromTime: '09:00', toDate: '2026-10-22', toTime: '09:00' })
    const target = makePlan({ id: 'c', fromDate: '2026-10-29', fromTime: '09:00', toDate: '2026-11-05', toTime: '09:00' })
    const found = findPrecedingEndedPlan(target, [earliest, middle, target], now)
    expect(found?.id).toBe('b')
  })

  it('returns undefined when no earlier plan has ended', () => {
    const now = new Date(2026, 10, 3).getTime()
    const notEnded = makePlan({ id: 'b', fromDate: '2026-10-15', fromTime: '09:00', toDate: '2026-12-01', toTime: '09:00' })
    const target = makePlan({ id: 'c', fromDate: '2026-10-29', fromTime: '09:00', toDate: '2026-11-05', toTime: '09:00' })
    expect(findPrecedingEndedPlan(target, [notEnded, target], now)).toBeUndefined()
  })

  it('never returns a plan that starts after the target', () => {
    const now = new Date(2026, 10, 20).getTime()
    const later = makePlan({ id: 'later', fromDate: '2026-11-10', fromTime: '09:00', toDate: '2026-11-12', toTime: '09:00' })
    const target = makePlan({ id: 'c', fromDate: '2026-10-29', fromTime: '09:00', toDate: '2026-11-05', toTime: '09:00' })
    expect(findPrecedingEndedPlan(target, [later, target], now)).toBeUndefined()
  })
})
