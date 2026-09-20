import { describe, expect, it } from 'vitest'
import { formatDuration } from './spotifyPlayer'

describe('formatDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatDuration(45_000)).toBe('0:45')
  })

  it('pads single-digit seconds', () => {
    expect(formatDuration(65_000)).toBe('1:05')
  })

  it('formats multi-minute durations', () => {
    expect(formatDuration(3 * 60_000 + 7_000)).toBe('3:07')
  })

  it('clamps negative durations to zero', () => {
    expect(formatDuration(-500)).toBe('0:00')
  })
})
