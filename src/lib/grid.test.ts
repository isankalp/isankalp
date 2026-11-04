import { describe, expect, it } from 'vitest'
import type { GridCell, GridRow } from '../db/models'
import { addDays, todayKey } from './date'
import {
  buildDateRange,
  dateRangeBetween,
  isDuplicateRowNameInSection,
  nextOrder,
  rowCompletedDateKeys,
  rowCompletionCount,
  rowCurrentStreak,
} from './grid'

describe('buildDateRange', () => {
  it('returns an inclusive range around the anchor date (DR-1)', () => {
    const range = buildDateRange('2026-01-10', 2, 3)
    expect(range).toEqual([
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
    ])
  })

  it('supports a zero-width range (just the anchor)', () => {
    expect(buildDateRange('2026-01-10', 0, 0)).toEqual(['2026-01-10'])
  })
})

describe('isDuplicateRowNameInSection', () => {
  const rows: GridRow[] = [
    { id: 'r1', sectionId: 's1', title: 'Meditate', order: 0, createdAt: 0, updatedAt: 0 },
    { id: 'r2', sectionId: 's1', title: 'Stretch', order: 1, createdAt: 0, updatedAt: 0 },
    { id: 'r3', sectionId: 's2', title: 'Meditate', order: 0, createdAt: 0, updatedAt: 0 },
  ]

  it('flags a case-insensitive name collision within the same section (RM-6)', () => {
    expect(isDuplicateRowNameInSection('meditate', rows, 's1')).toBe(true)
  })

  it('does not flag a collision across different sections', () => {
    expect(isDuplicateRowNameInSection('Meditate', rows, 's2', 'r3')).toBe(false)
  })

  it('excludes the row being edited from its own duplicate check', () => {
    expect(isDuplicateRowNameInSection('Meditate', rows, 's1', 'r1')).toBe(false)
  })

  it('does not flag a name with no collision', () => {
    expect(isDuplicateRowNameInSection('Journal', rows, 's1')).toBe(false)
  })
})

describe('nextOrder', () => {
  it('returns 0 for an empty list', () => {
    expect(nextOrder([])).toBe(0)
  })

  it('returns one past the current max order', () => {
    expect(nextOrder([{ order: 0 }, { order: 3 }, { order: 1 }])).toBe(4)
  })
})

describe('dateRangeBetween', () => {
  it('returns the inclusive range regardless of argument order (CC-4)', () => {
    expect(dateRangeBetween('2026-01-05', '2026-01-08')).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
    ])
    expect(dateRangeBetween('2026-01-08', '2026-01-05')).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
    ])
  })

  it('returns a single date when both ends match', () => {
    expect(dateRangeBetween('2026-01-05', '2026-01-05')).toEqual(['2026-01-05'])
  })
})

function cell(rowId: string, date: string): GridCell {
  return { id: `${rowId}-${date}`, rowId, date, createdAt: 0 }
}

describe('rowCompletedDateKeys', () => {
  it('collects only the dates belonging to the given row', () => {
    const cells = [cell('r1', '2026-01-01'), cell('r1', '2026-01-02'), cell('r2', '2026-01-01')]
    expect(rowCompletedDateKeys(cells, 'r1')).toEqual(new Set(['2026-01-01', '2026-01-02']))
  })
})

describe('rowCurrentStreak', () => {
  it('counts consecutive days ending today', () => {
    const today = todayKey()
    const cells = [cell('r1', today), cell('r1', addDays(today, -1)), cell('r1', addDays(today, -2))]
    expect(rowCurrentStreak(cells, 'r1')).toBe(3)
  })

  it('is zero once the streak is broken', () => {
    const today = todayKey()
    const cells = [cell('r1', addDays(today, -5))]
    expect(rowCurrentStreak(cells, 'r1')).toBe(0)
  })
})

describe('rowCompletionCount', () => {
  it('counts completions within the trailing window, inclusive of today (CC-6)', () => {
    const today = todayKey()
    const cells = [cell('r1', today), cell('r1', addDays(today, -1)), cell('r1', addDays(today, -10))]
    expect(rowCompletionCount(cells, 'r1', 30)).toEqual({ completed: 3, total: 30 })
    expect(rowCompletionCount(cells, 'r1', 5)).toEqual({ completed: 2, total: 5 })
  })
})
