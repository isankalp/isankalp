import { describe, expect, it } from 'vitest'
import { isDuplicateFieldName } from './customFields'
import type { CustomFieldDef } from '../db/models'

const existing: CustomFieldDef[] = [
  { id: 'a', name: 'Energy', type: 'number', createdAt: 0 },
  { id: 'b', name: 'Mood', type: 'text', createdAt: 0 },
]

describe('isDuplicateFieldName', () => {
  it('detects an exact duplicate', () => {
    expect(isDuplicateFieldName('Energy', existing)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isDuplicateFieldName('energy', existing)).toBe(true)
  })

  it('trims whitespace before comparing', () => {
    expect(isDuplicateFieldName('  Energy  ', existing)).toBe(true)
  })

  it('allows a non-duplicate name', () => {
    expect(isDuplicateFieldName('Location', existing)).toBe(false)
  })

  it('excludes the field being edited from the duplicate check', () => {
    expect(isDuplicateFieldName('Energy', existing, 'a')).toBe(false)
  })
})
