import { describe, expect, it } from 'vitest'
import {
  clampCompleted,
  dayMinutesDone,
  dayMinutesPlanned,
  dayPercentComplete,
  isTaskComplete,
  minutesDone,
  percentComplete,
  sortByPriority,
  totalMinutes,
  type Task,
} from './models'

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

describe('worked example: 5 min/question, 5 questions, 2 done', () => {
  const task = makeTask()

  it('totalMinutes = 25', () => {
    expect(totalMinutes(task)).toBe(25)
  })

  it('minutesDone = 10', () => {
    expect(minutesDone(task)).toBe(10)
  })

  it('percentComplete = 40%', () => {
    expect(percentComplete(task)).toBe(40)
  })

  it('is not yet complete', () => {
    expect(isTaskComplete(task)).toBe(false)
  })
})

describe('worked example: 1 min/page, 100 pages, none done', () => {
  const task = makeTask({ minutesPerSubtask: 1, totalSubtasks: 100, completedSubtasks: 0 })

  it('totalMinutes = 100', () => {
    expect(totalMinutes(task)).toBe(100)
  })

  it('minutesDone = 0', () => {
    expect(minutesDone(task)).toBe(0)
  })

  it('percentComplete = 0%', () => {
    expect(percentComplete(task)).toBe(0)
  })
})

describe('completion', () => {
  it('is complete exactly when completedSubtasks === totalSubtasks', () => {
    const task = makeTask({ totalSubtasks: 5, completedSubtasks: 5 })
    expect(isTaskComplete(task)).toBe(true)
    expect(percentComplete(task)).toBe(100)
  })

  it('a zero-subtask task is never complete', () => {
    const task = makeTask({ totalSubtasks: 0, completedSubtasks: 0 })
    expect(isTaskComplete(task)).toBe(false)
    expect(percentComplete(task)).toBe(0)
  })
})

describe('clampCompleted', () => {
  it('clamps above total down to total', () => {
    expect(clampCompleted(10, 5)).toBe(5)
  })

  it('clamps below zero up to zero', () => {
    expect(clampCompleted(-3, 5)).toBe(0)
  })

  it('passes through in-range values', () => {
    expect(clampCompleted(3, 5)).toBe(3)
  })

  it('rounds fractional input', () => {
    expect(clampCompleted(2.6, 5)).toBe(3)
  })

  it('treats NaN as zero', () => {
    expect(clampCompleted(Number.NaN, 5)).toBe(0)
  })

  it('never exceeds a zero total', () => {
    expect(clampCompleted(4, 0)).toBe(0)
  })
})

describe('day rollups', () => {
  const tasks: Task[] = [
    makeTask({ id: 't1', minutesPerSubtask: 1, totalSubtasks: 100, completedSubtasks: 0 }),
    makeTask({ id: 't2', minutesPerSubtask: 5, totalSubtasks: 5, completedSubtasks: 2 }),
  ]

  it('sums planned minutes across tasks', () => {
    expect(dayMinutesPlanned(tasks)).toBe(125)
  })

  it('sums done minutes across tasks', () => {
    expect(dayMinutesDone(tasks)).toBe(10)
  })

  it('computes overall day percent complete', () => {
    expect(dayPercentComplete(tasks)).toBe(Math.round((10 / 125) * 100))
  })

  it('is 0% for a day with no tasks', () => {
    expect(dayPercentComplete([])).toBe(0)
  })
})

describe('sortByPriority', () => {
  it('orders High before Medium before Low', () => {
    const tasks = [
      makeTask({ id: 'low', priority: 'Low', createdAt: 1 }),
      makeTask({ id: 'high', priority: 'High', createdAt: 2 }),
      makeTask({ id: 'medium', priority: 'Medium', createdAt: 3 }),
    ]
    expect(sortByPriority(tasks).map((t) => t.id)).toEqual(['high', 'medium', 'low'])
  })

  it('breaks ties within the same priority by creation order', () => {
    const tasks = [
      makeTask({ id: 'second', priority: 'High', createdAt: 2 }),
      makeTask({ id: 'first', priority: 'High', createdAt: 1 }),
    ]
    expect(sortByPriority(tasks).map((t) => t.id)).toEqual(['first', 'second'])
  })
})
