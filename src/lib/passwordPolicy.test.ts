import { describe, expect, it } from 'vitest'
import { isPasswordValid, passwordRuleResults } from './passwordPolicy'

describe('passwordRuleResults (SU-2)', () => {
  it('fails both rules for an empty password', () => {
    const results = passwordRuleResults('')
    expect(results.every((r) => !r.passed)).toBe(true)
  })

  it('fails the number rule for a letters-only password of sufficient length', () => {
    const results = passwordRuleResults('abcdefgh')
    expect(results.find((r) => r.id === 'length')!.passed).toBe(true)
    expect(results.find((r) => r.id === 'number')!.passed).toBe(false)
  })

  it('fails the length rule for a short password with a number', () => {
    const results = passwordRuleResults('ab1')
    expect(results.find((r) => r.id === 'length')!.passed).toBe(false)
    expect(results.find((r) => r.id === 'number')!.passed).toBe(true)
  })

  it('passes both rules for a valid password', () => {
    const results = passwordRuleResults('abcdefg1')
    expect(results.every((r) => r.passed)).toBe(true)
  })
})

describe('isPasswordValid', () => {
  it('rejects a password missing a number', () => {
    expect(isPasswordValid('abcdefgh')).toBe(false)
  })

  it('rejects a password under 8 characters', () => {
    expect(isPasswordValid('abc123')).toBe(false)
  })

  it('accepts a password meeting both rules', () => {
    expect(isPasswordValid('abcdefg1')).toBe(true)
  })
})
