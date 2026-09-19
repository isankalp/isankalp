import { describe, expect, it } from 'vitest'
import { currentPeriodKey, isPeriodInProgress, periodRange, shiftPeriod } from './review'
import { todayKey } from './date'

describe('review period math', () => {
  it('computes a week period key as the Sunday-start date', () => {
    // 2026-09-18 is a Friday
    expect(currentPeriodKey('week', '2026-09-18')).toBe('2026-09-13')
  })

  it('computes a month period key as YYYY-MM', () => {
    expect(currentPeriodKey('month', '2026-09-18')).toBe('2026-09')
  })

  it('week range spans 7 days starting from the period key', () => {
    expect(periodRange('week', '2026-09-13')).toEqual({ start: '2026-09-13', end: '2026-09-19' })
  })

  it('month range spans the whole calendar month', () => {
    expect(periodRange('month', '2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('month range handles a 31-day month correctly', () => {
    expect(periodRange('month', '2026-01')).toEqual({ start: '2026-01-01', end: '2026-01-31' })
  })

  it('shifts a week period key back and forward by 7 days', () => {
    expect(shiftPeriod('week', '2026-09-13', -1)).toBe('2026-09-06')
    expect(shiftPeriod('week', '2026-09-13', 1)).toBe('2026-09-20')
  })

  it('shifts a month period key across a year boundary', () => {
    expect(shiftPeriod('month', '2026-12', 1)).toBe('2027-01')
  })

  it('the current real-world week and month are always in progress', () => {
    const today = todayKey()
    expect(isPeriodInProgress('week', currentPeriodKey('week', today))).toBe(true)
    expect(isPeriodInProgress('month', currentPeriodKey('month', today))).toBe(true)
  })

  it('a period that ended in the past is not in progress', () => {
    expect(isPeriodInProgress('week', '2020-01-05')).toBe(false)
  })
})
