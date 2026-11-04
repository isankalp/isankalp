import { describe, expect, it } from 'vitest'
import { buildImportRows, isMappingValid, type ColumnMapping } from './csvImport'

const mapping: ColumnMapping = { title: 0, minutesPerSubtask: 1, totalSubtasks: 2 }

describe('isMappingValid', () => {
  it('requires all three columns mapped', () => {
    expect(isMappingValid(mapping)).toBe(true)
    expect(isMappingValid({ title: 0, minutesPerSubtask: null, totalSubtasks: 2 })).toBe(false)
  })
})

describe('buildImportRows', () => {
  it('returns empty when the mapping is incomplete', () => {
    expect(buildImportRows([['Read', '5', '10']], { title: 0, minutesPerSubtask: null, totalSubtasks: 2 })).toEqual([])
  })

  it('marks a row valid when all fields parse', () => {
    const rows = buildImportRows([['Read', '5', '10']], mapping)
    expect(rows).toEqual([
      { rowIndex: 1, title: 'Read', minutesPerSubtaskRaw: '5', totalSubtasksRaw: '10', valid: true, minutesPerSubtask: 5, totalSubtasks: 10 },
    ])
  })

  it('rejects a row with a non-numeric minutesPerSubtask, independently of other rows', () => {
    const rows = buildImportRows(
      [
        ['Read', 'not-a-number', '10'],
        ['Run', '2', '3'],
      ],
      mapping,
    )
    expect(rows[0].valid).toBe(false)
    expect(rows[0].reason).toMatch(/minutesPerSubtask/)
    expect(rows[1].valid).toBe(true)
  })

  it('rejects a row with a non-numeric totalSubtasks', () => {
    const rows = buildImportRows([['Read', '5', 'lots']], mapping)
    expect(rows[0].valid).toBe(false)
    expect(rows[0].reason).toMatch(/totalSubtasks/)
  })

  it('rejects a row with a missing title', () => {
    const rows = buildImportRows([['', '5', '10']], mapping)
    expect(rows[0].valid).toBe(false)
    expect(rows[0].reason).toMatch(/title/i)
  })

  it('rejects zero/negative numeric values', () => {
    const rows = buildImportRows([['Read', '0', '10']], mapping)
    expect(rows[0].valid).toBe(false)
  })

  it('floors a fractional totalSubtasks on a valid row', () => {
    const rows = buildImportRows([['Read', '5', '10.7']], mapping)
    expect(rows[0].totalSubtasks).toBe(10)
  })
})
