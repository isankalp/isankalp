import { describe, expect, it } from 'vitest'
import { isValidWebhookUrl } from './webhook'

describe('isValidWebhookUrl', () => {
  it('treats an empty string as valid (not configured)', () => {
    expect(isValidWebhookUrl('')).toBe(true)
  })

  it('accepts http(s) URLs', () => {
    expect(isValidWebhookUrl('https://example.com/hook')).toBe(true)
    expect(isValidWebhookUrl('http://localhost:3000/hook')).toBe(true)
  })

  it('rejects malformed URLs', () => {
    expect(isValidWebhookUrl('not a url')).toBe(false)
  })

  it('rejects non-http(s) schemes', () => {
    expect(isValidWebhookUrl('ftp://example.com')).toBe(false)
  })
})
