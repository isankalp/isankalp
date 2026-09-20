import { describe, expect, it } from 'vitest'
import { availableCategories, availableUnits, computeHeatmapDays, hasAnyHistory, heatmapRangeStart, shadeLevel } from './heatmap'
import type { Day, Task } from '../db/models'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dayId: 'd1',
    minutesPerSubtask: 5,
    totalSubtasks: 4,
    completedSubtasks: 2,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('heatmapRangeStart', () => {
  it('spans exactly 53 weeks ending on endDate', () => {
    const start = heatmapRangeStart('2026-09-20')
    // (53 * 7) - 1 days back
    expect(start).toBe('2025-09-15')
  })
})

describe('computeHeatmapDays', () => {
  const days: Day[] = [
    { id: 'd1', date: '2026-09-18' },
    { id: 'd2', date: '2026-09-19' },
  ]

  it('computes planned/done/percent per day from matching tasks', () => {
    const tasks = [makeTask({ dayId: 'd1', minutesPerSubtask: 5, totalSubtasks: 4, completedSubtasks: 2 })]
    const result = computeHeatmapDays(days, tasks, {}, '2026-09-19')
    const cell = result.find((c) => c.date === '2026-09-18')!
    expect(cell).toMatchObject({ planned: 20, done: 10, percent: 50 })
  })

  it('is zero for a day with no matching tasks', () => {
    const result = computeHeatmapDays(days, [], {}, '2026-09-19')
    expect(result.every((c) => c.planned === 0 && c.percent === 0)).toBe(true)
  })

  it('CU-4: filtering by unit excludes tasks in other units', () => {
    const tasks = [
      makeTask({ id: 'm', dayId: 'd1', unit: 'minutes' }),
      makeTask({ id: 'p', dayId: 'd1', unit: 'pages', minutesPerSubtask: 10, totalSubtasks: 10, completedSubtasks: 10 }),
    ]
    const minutesOnly = computeHeatmapDays(days, tasks, { unitKey: 'minutes' }, '2026-09-19')
    const cell = minutesOnly.find((c) => c.date === '2026-09-18')!
    expect(cell.percent).toBe(50) // only the minutes task counted, not the fully-done pages task
  })

  it('filters by category/tag', () => {
    const tasks = [
      makeTask({ id: 'work', dayId: 'd1', category: { label: 'Work', color: '#000', icon: '💼' } }),
      makeTask({ id: 'home', dayId: 'd1', category: { label: 'Home', color: '#000', icon: '🏠' }, completedSubtasks: 4 }),
    ]
    const workOnly = computeHeatmapDays(days, tasks, { category: 'Work' }, '2026-09-19')
    const cell = workOnly.find((c) => c.date === '2026-09-18')!
    expect(cell.percent).toBe(50) // Home task (100%) excluded
  })
})

describe('availableUnits / availableCategories', () => {
  it('lists distinct units with minutes first', () => {
    const tasks = [makeTask({ unit: 'pages' }), makeTask({ unit: 'minutes' }), makeTask({ unit: 'pages' })]
    expect(availableUnits(tasks).map((u) => u.key)).toEqual(['minutes', 'pages'])
  })

  it('lists distinct category labels', () => {
    const tasks = [
      makeTask({ category: { label: 'Work', color: '#000', icon: '' } }),
      makeTask({ category: { label: 'Home', color: '#000', icon: '' } }),
      makeTask({}),
    ]
    expect(availableCategories(tasks)).toEqual(['Home', 'Work'])
  })
})

describe('shadeLevel', () => {
  it('buckets percent into 5 levels', () => {
    expect(shadeLevel(0)).toBe(0)
    expect(shadeLevel(10)).toBe(1)
    expect(shadeLevel(40)).toBe(2)
    expect(shadeLevel(60)).toBe(3)
    expect(shadeLevel(100)).toBe(4)
  })
})

describe('hasAnyHistory', () => {
  it('is false when every day is empty', () => {
    expect(hasAnyHistory([{ date: '2026-01-01', planned: 0, done: 0, percent: 0 }])).toBe(false)
  })

  it('is true when at least one day has planned amount', () => {
    expect(hasAnyHistory([{ date: '2026-01-01', planned: 10, done: 5, percent: 50 }])).toBe(true)
  })
})
