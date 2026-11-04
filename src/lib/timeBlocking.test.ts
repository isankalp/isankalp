import { describe, expect, it } from 'vitest'
import { gridMinutesToTime, layoutBlocks, overlappingBlockIds, snapTo15, timeToGridMinutes } from './timeBlocking'

describe('timeToGridMinutes / gridMinutesToTime', () => {
  it('maps the grid start (6am) to 0', () => {
    expect(timeToGridMinutes('06:00')).toBe(0)
    expect(gridMinutesToTime(0)).toBe('06:00')
  })

  it('round-trips a mid-grid time', () => {
    expect(timeToGridMinutes('14:30')).toBe(510)
    expect(gridMinutesToTime(510)).toBe('14:30')
  })

  it('clamps below the grid start', () => {
    expect(timeToGridMinutes('03:00')).toBe(0)
  })

  it('clamps above the grid end (11pm)', () => {
    expect(timeToGridMinutes('23:59')).toBe(1020)
    expect(gridMinutesToTime(2000)).toBe('23:00')
  })
})

describe('snapTo15 (TB-2/TB-3)', () => {
  it('snaps down within 7 minutes', () => {
    expect(snapTo15(52)).toBe(45)
  })

  it('snaps up within 8+ minutes', () => {
    expect(snapTo15(53)).toBe(60)
  })

  it('leaves an exact multiple of 15 unchanged', () => {
    expect(snapTo15(30)).toBe(30)
  })
})

describe('overlappingBlockIds (TB-4)', () => {
  it('flags two blocks that overlap in time', () => {
    const result = overlappingBlockIds([
      { id: 'a', start: 0, duration: 60 },
      { id: 'b', start: 30, duration: 60 },
    ])
    expect(result).toEqual(new Set(['a', 'b']))
  })

  it('does not flag adjacent, non-overlapping blocks', () => {
    const result = overlappingBlockIds([
      { id: 'a', start: 0, duration: 60 },
      { id: 'b', start: 60, duration: 60 },
    ])
    expect(result.size).toBe(0)
  })

  it('flags only the two that actually overlap in a set of three', () => {
    const result = overlappingBlockIds([
      { id: 'a', start: 0, duration: 30 },
      { id: 'b', start: 100, duration: 30 },
      { id: 'c', start: 15, duration: 30 },
    ])
    expect(result).toEqual(new Set(['a', 'c']))
  })

  it('is empty for a single block', () => {
    expect(overlappingBlockIds([{ id: 'a', start: 0, duration: 30 }]).size).toBe(0)
  })
})

describe('layoutBlocks (fully-overlapping blocks stay independently clickable)', () => {
  it('gives a non-overlapping block full width (columnCount 1)', () => {
    const result = layoutBlocks([{ id: 'a', start: 0, duration: 30 }])
    expect(result).toEqual([{ id: 'a', column: 0, columnCount: 1 }])
  })

  it('splits two fully-overlapping blocks into side-by-side columns', () => {
    const result = layoutBlocks([
      { id: 'a', start: 0, duration: 30 },
      { id: 'b', start: 0, duration: 30 },
    ])
    const byId = new Map(result.map((r) => [r.id, r]))
    expect(byId.get('a')).toEqual({ id: 'a', column: 0, columnCount: 2 })
    expect(byId.get('b')).toEqual({ id: 'b', column: 1, columnCount: 2 })
  })

  it('keeps two separate non-overlapping clusters independent (2 blocks each, not 4)', () => {
    const result = layoutBlocks([
      { id: 'a', start: 0, duration: 30 },
      { id: 'b', start: 0, duration: 30 },
      { id: 'c', start: 200, duration: 30 },
      { id: 'd', start: 200, duration: 30 },
    ])
    const byId = new Map(result.map((r) => [r.id, r]))
    expect(byId.get('a')!.columnCount).toBe(2)
    expect(byId.get('c')!.columnCount).toBe(2)
  })

  it('groups a chain of pairwise overlaps (a-b overlap, b-c overlap, a-c do not) into one 3-way cluster', () => {
    const result = layoutBlocks([
      { id: 'a', start: 0, duration: 20 },
      { id: 'b', start: 10, duration: 20 },
      { id: 'c', start: 25, duration: 20 },
    ])
    expect(result.every((r) => r.columnCount === 3)).toBe(true)
  })
})
