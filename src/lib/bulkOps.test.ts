import { describe, expect, it } from 'vitest'
import { resetFieldsForDuplicate } from './bulkOps'
import type { Task } from '../db/models'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dayId: 'd1',
    minutesPerSubtask: 5,
    totalSubtasks: 4,
    completedSubtasks: 3,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('resetFieldsForDuplicate (BO-3)', () => {
  it('resets completedSubtasks to 0, keeping totalSubtasks for a numeric-mode task', () => {
    const result = resetFieldsForDuplicate(makeTask({ completedSubtasks: 3, totalSubtasks: 4 }))
    expect(result.completedSubtasks).toBe(0)
    expect(result.totalSubtasks).toBe(4)
  })

  it('unchecks every named subtask item, recomputing totals from the item count', () => {
    const task = makeTask({
      subtaskItems: [
        { id: '1', title: 'Q1', completed: true },
        { id: '2', title: 'Q2', completed: true },
        { id: '3', title: 'Q3', completed: false },
      ],
    })
    const result = resetFieldsForDuplicate(task)
    expect(result.subtaskItems).toEqual([
      { id: '1', title: 'Q1', completed: false },
      { id: '2', title: 'Q2', completed: false },
      { id: '3', title: 'Q3', completed: false },
    ])
    expect(result.completedSubtasks).toBe(0)
    expect(result.totalSubtasks).toBe(3)
  })

  it('drops per-instance history so a duplicate starts clean', () => {
    const task = makeTask({
      rolledOverFromTaskId: 'x',
      rolledOverFromTitle: 'Yesterday',
      actualMinutes: 42,
      energyRating: 4,
      googleEventId: 'evt-1',
    })
    const result = resetFieldsForDuplicate(task)
    expect(result.rolledOverFromTaskId).toBeUndefined()
    expect(result.rolledOverFromTitle).toBeUndefined()
    expect(result.actualMinutes).toBeUndefined()
    expect(result.energyRating).toBeUndefined()
    expect(result.googleEventId).toBeUndefined()
  })
})
