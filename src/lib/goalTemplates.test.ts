import { describe, expect, it } from 'vitest'
import { GOAL_TEMPLATES, searchGoalTemplates } from './goalTemplates'

describe('searchGoalTemplates', () => {
  it('returns all templates for an empty query', () => {
    expect(searchGoalTemplates('')).toEqual(GOAL_TEMPLATES)
  })

  it('matches by title, case-insensitively', () => {
    const results = searchGoalTemplates('BOOKS')
    expect(results.some((t) => t.id === 'read-24-books')).toBe(true)
  })

  it('matches by description', () => {
    const results = searchGoalTemplates('mindfulness')
    expect(results.some((t) => t.id === 'meditate')).toBe(true)
  })

  it('returns empty for a term with no matches (OB-5)', () => {
    expect(searchGoalTemplates('xyznonexistent')).toEqual([])
  })
})
