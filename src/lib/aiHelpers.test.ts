import { describe, expect, it } from 'vitest'
import { aiConfigured, maskApiKey } from './aiHelpers'

describe('aiConfigured', () => {
  it('is false when no key is set', () => {
    expect(aiConfigured({})).toBe(false)
  })

  it('is false for a whitespace-only key', () => {
    expect(aiConfigured({ aiApiKey: '   ' })).toBe(false)
  })

  it('is true once a non-empty key is set', () => {
    expect(aiConfigured({ aiApiKey: 'sk-ant-abc123' })).toBe(true)
  })
})

describe('maskApiKey', () => {
  it('shows only the first 6 and last 4 characters of a normal key', () => {
    expect(maskApiKey('sk-ant-api03-abcdefgh')).toBe('sk-ant...efgh')
  })

  it('fully masks a very short key rather than exposing it', () => {
    expect(maskApiKey('short')).toBe('••••')
  })
})
