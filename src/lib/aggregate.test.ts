import { describe, expect, it } from 'vitest'
import type { Day, Task } from '../db/models'
import { dailyCompletionSummaries } from './aggregate'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dayId: 'd1',
    minutesPerSubtask: 5,
    totalSubtasks: 5,
    completedSubtasks: 5,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('dailyCompletionSummaries (Epic 72/73)', () => {
  const days: Day[] = [{ id: 'd1', date: '2026-01-01' }, { id: 'd2', date: '2026-01-02' }, { id: 'd3', date: '2026-01-03' }]

  it('pairs each day with its own completion state and aggregate percent', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', dayId: 'd1', totalSubtasks: 10, completedSubtasks: 10 }), // complete day
      makeTask({ id: 't2', dayId: 'd2', totalSubtasks: 10, completedSubtasks: 9 }), // incomplete day, 90%
      // d3 has no tasks at all
    ]
    const summaries = dailyCompletionSummaries(days, tasks)
    expect(summaries).toEqual([
      { date: '2026-01-01', state: 'complete', percent: 100 },
      { date: '2026-01-02', state: 'incomplete', percent: 90 },
      { date: '2026-01-03', state: 'none', percent: null },
    ])
  })

  it('is incomplete (red) even at 90% aggregate, per DP-3', () => {
    const tasks: Task[] = [makeTask({ dayId: 'd2', totalSubtasks: 10, completedSubtasks: 9 })]
    const [summary] = dailyCompletionSummaries([days[1]], tasks)
    expect(summary.state).toBe('incomplete')
    expect(summary.percent).toBe(90)
  })
})
