import { describe, expect, it } from 'vitest'
import { extractNumbers, isGrounded } from './grounding'

describe('extractNumbers', () => {
  it('finds every standalone number in text', () => {
    expect(extractNumbers('You did 45 minutes across 3 tasks on the 12th.')).toEqual([45, 3, 12])
  })

  it('handles decimals', () => {
    expect(extractNumbers('Average of 12.5 minutes per day')).toEqual([12.5])
  })

  it('returns an empty array when there are no numbers', () => {
    expect(extractNumbers('No numbers here')).toEqual([])
  })
})

describe('isGrounded', () => {
  it('accepts text using only allowed numbers', () => {
    expect(isGrounded('You completed 45 of 60 minutes.', [45, 60])).toBe(true)
  })

  it('rejects text with a number not in the allowed set', () => {
    expect(isGrounded('You completed 999 minutes.', [45, 60])).toBe(false)
  })

  it('always allows small numbers 0-31 for date/weekday references', () => {
    expect(isGrounded('This happened on the 12th, three times.', [45])).toBe(true)
  })

  it('rejects a fabricated large figure even alongside allowed ones', () => {
    expect(isGrounded('You did 45 minutes, way more than your usual 500.', [45])).toBe(false)
  })
})
