import { describe, expect, it } from 'vitest'
import { checkFeasibility, historicalDailyPace } from './feasibility'
import type { Task } from '../db/models'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dayId: 'd1',
    minutesPerSubtask: 10,
    totalSubtasks: 5,
    completedSubtasks: 5,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('checkFeasibility', () => {
  it('flags overBudget when required pace meaningfully exceeds historical pace', () => {
    const result = checkFeasibility(1000, 5, 100) // 200/day required vs 100/day historical
    expect(result.requiredDailyMinutes).toBe(200)
    expect(result.percentOver).toBe(100)
    expect(result.overBudget).toBe(true)
  })

  it('does not flag when required pace is close to historical pace', () => {
    const result = checkFeasibility(510, 5, 100) // 102/day vs 100/day historical, within 15%
    expect(result.overBudget).toBe(false)
  })

  it('never flags overBudget when there is no historical data to compare against', () => {
    const result = checkFeasibility(10_000, 1, 0)
    expect(result.overBudget).toBe(false)
    expect(result.percentOver).toBe(0)
  })

  it('treats zero available days as needing everything in one day', () => {
    const result = checkFeasibility(300, 0, 100)
    expect(result.requiredDailyMinutes).toBe(300)
  })
})

describe('historicalDailyPace', () => {
  it('averages minutes done only across days that actually have tasks', () => {
    const byDay = new Map<string, Task[]>([
      ['d1', [task({ completedSubtasks: 5 })]], // 50 min done
      ['d2', []], // no tasks — excluded from the average
      ['d3', [task({ completedSubtasks: 3 })]], // 30 min done
    ])
    expect(historicalDailyPace(byDay)).toBe(40) // (50 + 30) / 2
  })

  it('returns 0 when there are no active days at all', () => {
    expect(historicalDailyPace(new Map())).toBe(0)
  })
})
