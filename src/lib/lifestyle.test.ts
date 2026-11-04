import { describe, expect, it } from 'vitest'
import type { LifestyleEntry, LifestyleField } from '../db/models'
import {
  calculateDurationMinutes,
  evaluateLifestyleEntry,
  formatDurationMinutes,
  isDuplicateFieldName,
  lifestyleDayState,
  parseTimeToMinutes,
} from './lifestyle'

describe('parseTimeToMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
    expect(parseTimeToMinutes('07:30')).toBe(450)
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })
})

describe('formatDurationMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatDurationMinutes(450)).toBe('7h 30m')
    expect(formatDurationMinutes(60)).toBe('1h')
    expect(formatDurationMinutes(45)).toBe('45m')
  })
})

describe('calculateDurationMinutes', () => {
  it('handles overnight wraparound (ST-2)', () => {
    expect(calculateDurationMinutes('23:30', '07:00', false)).toBe(450)
  })

  it('handles a same-evening pair without wrapping', () => {
    expect(calculateDurationMinutes('20:00', '22:00', false)).toBe(120)
  })

  it('rejects identical sleep/wake times (ST-4)', () => {
    expect(calculateDurationMinutes('07:00', '07:00', false)).toBeNull()
    expect(calculateDurationMinutes('07:00', '07:00', true)).toBeNull()
  })

  it('supports same-day nap entries without the overnight assumption (ST-3)', () => {
    expect(calculateDurationMinutes('14:00', '15:30', true)).toBe(90)
  })

  it('rejects a same-day entry where end is before start', () => {
    expect(calculateDurationMinutes('15:00', '14:00', true)).toBeNull()
  })

  it('returns null when either time is missing', () => {
    expect(calculateDurationMinutes('', '07:00', false)).toBeNull()
    expect(calculateDurationMinutes('23:00', '', false)).toBeNull()
  })
})

function makeField(overrides: Partial<LifestyleField> = {}): LifestyleField {
  return {
    id: 'f1',
    name: 'Sleep',
    type: 'duration',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('evaluateLifestyleEntry', () => {
  it('evaluates a boolean field against its expected value', () => {
    const field = makeField({ type: 'boolean', booleanExpected: true })
    expect(evaluateLifestyleEntry(field, { boolValue: true })).toBe(true)
    expect(evaluateLifestyleEntry(field, { boolValue: false })).toBe(false)
  })

  it('evaluates a boolean field with a count cap', () => {
    const field = makeField({ type: 'boolean', booleanExpected: true, booleanCountEnabled: true, booleanCountMax: 2 })
    expect(evaluateLifestyleEntry(field, { boolValue: true, countValue: 2 })).toBe(true)
    expect(evaluateLifestyleEntry(field, { boolValue: true, countValue: 3 })).toBe(false)
  })

  it('evaluates a duration field against a min/max range', () => {
    const field = makeField({ type: 'duration', durationMinMinutes: 420, durationMaxMinutes: 540 })
    expect(evaluateLifestyleEntry(field, { durationMinutes: 450 })).toBe(true)
    expect(evaluateLifestyleEntry(field, { durationMinutes: 300 })).toBe(false)
    expect(evaluateLifestyleEntry(field, { durationMinutes: undefined })).toBe(false)
  })

  it('evaluates a number field against a min/max limit', () => {
    const field = makeField({ type: 'number', numberMax: 120 })
    expect(evaluateLifestyleEntry(field, { numberValue: 90 })).toBe(true)
    expect(evaluateLifestyleEntry(field, { numberValue: 150 })).toBe(false)
  })
})

function makeEntry(overrides: Partial<LifestyleEntry> = {}): LifestyleEntry {
  return { id: 'e1', date: '2026-01-01', fieldId: 'f1', passed: true, updatedAt: 0, ...overrides }
}

describe('lifestyleDayState', () => {
  it('is none with zero entries', () => {
    expect(lifestyleDayState([], ['f1', 'f2'])).toBe('none')
  })

  it('is pass only when every active field has a passing entry', () => {
    const entries = [makeEntry({ fieldId: 'f1', passed: true }), makeEntry({ fieldId: 'f2', passed: true })]
    expect(lifestyleDayState(entries, ['f1', 'f2'])).toBe('pass')
  })

  it('is fail when any entry failed', () => {
    const entries = [makeEntry({ fieldId: 'f1', passed: true }), makeEntry({ fieldId: 'f2', passed: false })]
    expect(lifestyleDayState(entries, ['f1', 'f2'])).toBe('fail')
  })

  it('is fail when a configured field has no entry at all', () => {
    const entries = [makeEntry({ fieldId: 'f1', passed: true })]
    expect(lifestyleDayState(entries, ['f1', 'f2'])).toBe('fail')
  })
})

describe('isDuplicateFieldName', () => {
  it('rejects a case-insensitive collision with an active field', () => {
    const fields = [makeField({ id: 'f1', name: 'Sleep' })]
    expect(isDuplicateFieldName('sleep', fields)).toBe(true)
    expect(isDuplicateFieldName('Screen Time', fields)).toBe(false)
  })

  it('ignores archived fields and the field being edited', () => {
    const fields = [makeField({ id: 'f1', name: 'Sleep', archivedAt: Date.now() }), makeField({ id: 'f2', name: 'Water' })]
    expect(isDuplicateFieldName('Sleep', fields)).toBe(false)
    expect(isDuplicateFieldName('Water', fields, 'f2')).toBe(false)
  })
})
