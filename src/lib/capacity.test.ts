import { describe, expect, it } from 'vitest'
import { capacityPercent, checkCapacity, isCapacityEnabled, minutesUnitPlanned } from './capacity'
import type { Task } from '../db/models'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dayId: 'd1',
    minutesPerSubtask: 10,
    totalSubtasks: 3,
    completedSubtasks: 0,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('isCapacityEnabled (CP-5: fully opt-in)', () => {
  it('is disabled when mode is off, regardless of budget', () => {
    expect(isCapacityEnabled('off', 500)).toBe(false)
  })

  it('is disabled when budget is zero or negative', () => {
    expect(isCapacityEnabled('daily', 0)).toBe(false)
    expect(isCapacityEnabled('daily', -10)).toBe(false)
  })

  it('is enabled with a mode and a positive budget', () => {
    expect(isCapacityEnabled('daily', 60)).toBe(true)
    expect(isCapacityEnabled('weekly', 300)).toBe(true)
  })
})

describe('minutesUnitPlanned (CU-4: only minutes-unit tasks count)', () => {
  it('excludes non-minutes tasks from the planned total', () => {
    const tasks = [
      makeTask({ id: 'm', unit: 'minutes', minutesPerSubtask: 10, totalSubtasks: 3 }),
      makeTask({ id: 'p', unit: 'pages', minutesPerSubtask: 100, totalSubtasks: 10 }),
    ]
    expect(minutesUnitPlanned(tasks)).toBe(30)
  })
})

describe('checkCapacity (CP-2)', () => {
  it('is not over budget when the new total fits', () => {
    const existing = [makeTask({ minutesPerSubtask: 10, totalSubtasks: 3 })] // 30 planned
    const result = checkCapacity(existing, 20, 60)
    expect(result).toMatchObject({ currentPlanned: 30, totalAfter: 50, overBudget: false, budget: 60 })
  })

  it('flags over budget once the new task would push past it', () => {
    const existing = [makeTask({ minutesPerSubtask: 10, totalSubtasks: 3 })] // 30 planned
    const result = checkCapacity(existing, 40, 60)
    expect(result).toMatchObject({ currentPlanned: 30, totalAfter: 70, overBudget: true })
  })

  it('reflects zero planned for an empty day', () => {
    const result = checkCapacity([], 30, 60)
    expect(result).toMatchObject({ currentPlanned: 0, totalAfter: 30, overBudget: false })
  })
})

describe('capacityPercent', () => {
  it('computes percent of budget used', () => {
    expect(capacityPercent(30, 60)).toBe(50)
    expect(capacityPercent(90, 60)).toBe(150)
  })

  it('is zero for a zero budget (avoids divide-by-zero)', () => {
    expect(capacityPercent(30, 0)).toBe(0)
  })
})
