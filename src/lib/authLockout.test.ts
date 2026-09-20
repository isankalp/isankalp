import { describe, expect, it } from 'vitest'
import { computeLockoutStatus, nextStateAfterFailure, stateAfterSuccess, type LockoutState } from './authLockout'

describe('computeLockoutStatus', () => {
  it('is unlocked with no lockedUntil set', () => {
    const state: LockoutState = { attempts: 2, lockedUntil: null }
    expect(computeLockoutStatus(state, 1000)).toEqual({ locked: false, remainingMs: 0 })
  })

  it('is locked while now is before lockedUntil', () => {
    const state: LockoutState = { attempts: 0, lockedUntil: 5000 }
    expect(computeLockoutStatus(state, 1000)).toEqual({ locked: true, remainingMs: 4000 })
  })

  it('is unlocked once now reaches lockedUntil', () => {
    const state: LockoutState = { attempts: 0, lockedUntil: 5000 }
    expect(computeLockoutStatus(state, 5000)).toEqual({ locked: false, remainingMs: 0 })
  })
})

describe('nextStateAfterFailure (LI-5: locks out on the 5th consecutive failure)', () => {
  it('increments attempts below the threshold without locking', () => {
    const state: LockoutState = { attempts: 0, lockedUntil: null }
    const next = nextStateAfterFailure(state, 1000)
    expect(next).toEqual({ attempts: 1, lockedUntil: null })
  })

  it('locks out on the 5th consecutive failure and resets the counter', () => {
    let state: LockoutState = { attempts: 0, lockedUntil: null }
    for (let i = 0; i < 4; i++) state = nextStateAfterFailure(state, 1000)
    expect(state.attempts).toBe(4)
    const fifth = nextStateAfterFailure(state, 1000)
    expect(fifth.attempts).toBe(0)
    expect(fifth.lockedUntil).toBeGreaterThan(1000)
  })
})

describe('stateAfterSuccess', () => {
  it('clears attempts and lockout on a successful login', () => {
    expect(stateAfterSuccess()).toEqual({ attempts: 0, lockedUntil: null })
  })
})
