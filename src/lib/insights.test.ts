import { describe, expect, it } from 'vitest'
import type { Day, Task } from '../db/models'
import {
  MIN_RATED_TASKS,
  effortVarianceRows,
  energyCorrelation,
  generateObservations,
  timeOfDayBuckets,
  weekdayCompletionStats,
  weeksOfHistory,
} from './insights'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Solve questions',
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

function makeDay(date: string, id = date): Day {
  return { id, date }
}

describe('weeksOfHistory', () => {
  it('is 0 for no days', () => {
    expect(weeksOfHistory([])).toBe(0)
  })

  it('computes span in weeks between earliest and latest day', () => {
    const days = [makeDay('2026-01-01'), makeDay('2026-01-29')]
    expect(weeksOfHistory(days)).toBe(4)
  })
})

describe('weekdayCompletionStats', () => {
  it('groups day completion percent by weekday, skipping days with no tasks', () => {
    // 2026-01-04 is a Sunday
    const days = [makeDay('2026-01-04'), makeDay('2026-01-05'), makeDay('2026-01-11')]
    const tasks = [
      makeTask({ id: 'a', dayId: '2026-01-04', totalSubtasks: 10, completedSubtasks: 10 }),
      makeTask({ id: 'b', dayId: '2026-01-11', totalSubtasks: 10, completedSubtasks: 5 }),
    ]
    const stats = weekdayCompletionStats(days, tasks)
    expect(stats).toEqual([{ weekday: 0, avgPercent: 75, dayCount: 2 }])
  })
})

describe('generateObservations', () => {
  it('is empty with no stats', () => {
    expect(generateObservations([])).toEqual([])
  })

  it('flags a strong weekend-vs-weekday gap', () => {
    const stats = [
      { weekday: 0, avgPercent: 90, dayCount: 4 }, // Sunday
      { weekday: 6, avgPercent: 90, dayCount: 4 }, // Saturday
      { weekday: 1, avgPercent: 40, dayCount: 4 },
      { weekday: 2, avgPercent: 40, dayCount: 4 },
      { weekday: 3, avgPercent: 40, dayCount: 4 },
    ]
    const observations = generateObservations(stats)
    expect(observations.some((o) => o.includes('more on weekends'))).toBe(true)
  })

  it('produces no observations when variance is negligible', () => {
    const stats = [
      { weekday: 0, avgPercent: 50, dayCount: 4 },
      { weekday: 1, avgPercent: 51, dayCount: 4 },
      { weekday: 2, avgPercent: 49, dayCount: 4 },
    ]
    expect(generateObservations(stats)).toEqual([])
  })
})

describe('timeOfDayBuckets', () => {
  it('sums positive deltas into the hour of the event, ignoring negative deltas', () => {
    const nineAm = new Date(2026, 0, 1, 9).getTime()
    const threePm = new Date(2026, 0, 1, 15).getTime()
    const events = [
      { at: nineAm, delta: 1 },
      { at: nineAm, delta: 2 },
      { at: threePm, delta: 1 },
      { at: threePm, delta: -1 },
    ]
    const buckets = timeOfDayBuckets(events)
    expect(buckets[9].count).toBe(3)
    expect(buckets[15].count).toBe(1)
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(4)
  })
})

describe('effortVarianceRows', () => {
  it('computes planned vs actual variance, skipping tasks with no actual time', () => {
    const tasks = [
      makeTask({ id: 'a', minutesPerSubtask: 10, totalSubtasks: 5, actualMinutes: 60 }), // planned 50, actual 60 -> +20%
      makeTask({ id: 'b', minutesPerSubtask: 10, totalSubtasks: 5 }),
    ]
    const rows = effortVarianceRows(tasks)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ plannedMinutes: 50, actualMinutes: 60, variancePercent: 20 })
  })
})

describe('energyCorrelation', () => {
  it('requires at least MIN_RATED_TASKS rated tasks', () => {
    const tasks = Array.from({ length: MIN_RATED_TASKS - 1 }, (_, i) => makeTask({ id: `t${i}`, energyRating: 3 }))
    expect(energyCorrelation(tasks)).toEqual([])
  })

  it('averages completion percent per rating once the threshold is met', () => {
    const tasks = [
      ...Array.from({ length: MIN_RATED_TASKS }, (_, i) =>
        makeTask({ id: `high-${i}`, energyRating: 5, totalSubtasks: 10, completedSubtasks: 10 }),
      ),
    ]
    const rows = energyCorrelation(tasks)
    expect(rows).toEqual([{ rating: 5, avgPercent: 100, taskCount: MIN_RATED_TASKS }])
  })
})
