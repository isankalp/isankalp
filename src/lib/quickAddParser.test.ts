import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAddParser'

describe('parseQuickAdd', () => {
  it('parses the PRD example: "50 pages reading, 1 min each"', () => {
    const result = parseQuickAdd('50 pages reading, 1 min each')
    expect(result.success).toBe(true)
    expect(result.parsed).toEqual({ title: 'reading', minutesPerSubtask: 1, totalSubtasks: 50 })
  })

  it('parses without a comma', () => {
    const result = parseQuickAdd('50 pages reading 1 min each')
    expect(result.success).toBe(true)
    expect(result.parsed).toEqual({ title: 'reading', minutesPerSubtask: 1, totalSubtasks: 50 })
  })

  it('parses when the unit word is not adjacent to the count', () => {
    const result = parseQuickAdd('Solve 20 DSA questions, 5 min each')
    expect(result.success).toBe(true)
    expect(result.parsed).toEqual({ title: 'Solve DSA questions', minutesPerSubtask: 5, totalSubtasks: 20 })
  })

  it('parses "minutes" spelled out with "per subtask"', () => {
    const result = parseQuickAdd('Read 30 pages, 2 minutes per subtask')
    expect(result.success).toBe(true)
    expect(result.parsed).toMatchObject({ title: 'Read', minutesPerSubtask: 2, totalSubtasks: 30 })
  })

  it('falls back when there is no number at all', () => {
    const result = parseQuickAdd('Buy groceries')
    expect(result.success).toBe(false)
    expect(result.recognized.title).toBe('Buy groceries')
    expect(result.recognized.minutesPerSubtask).toBeUndefined()
    expect(result.recognized.totalSubtasks).toBeUndefined()
  })

  it('falls back when only one number is present (ambiguous)', () => {
    const result = parseQuickAdd('Read for 30 minutes')
    expect(result.success).toBe(false)
    expect(result.recognized.minutesPerSubtask).toBe(30)
    expect(result.recognized.totalSubtasks).toBeUndefined()
  })

  it('falls back on empty input', () => {
    const result = parseQuickAdd('   ')
    expect(result.success).toBe(false)
  })

  it('falls back when the title would be empty after stripping numbers', () => {
    const result = parseQuickAdd('20, 5 min each')
    expect(result.success).toBe(false)
  })

  it('never returns success with a non-positive number', () => {
    const result = parseQuickAdd('0 pages reading, 1 min each')
    expect(result.success).toBe(false)
  })
})
