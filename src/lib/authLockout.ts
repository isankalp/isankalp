/**
 * LI-5: lockout after 5 failed login attempts in a row, with a cooldown.
 * Honest limitation: this is tracked in this browser's localStorage only — it protects a user's
 * own device from brute-force pain, but is NOT a real server-side rate limit. A determined
 * attacker could bypass it by clearing storage or using a different client. True abuse
 * prevention needs a server-side check (e.g. a Supabase Edge Function), which is out of scope
 * here — this app has no custom server.
 */
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 60_000
const STORAGE_PREFIX = 'goals-tracker:loginAttempts:'

export interface LockoutState {
  attempts: number
  lockedUntil: number | null
}

export interface LockoutStatus {
  locked: boolean
  remainingMs: number
}

const EMPTY_STATE: LockoutState = { attempts: 0, lockedUntil: null }

export function computeLockoutStatus(state: LockoutState, now: number): LockoutStatus {
  if (state.lockedUntil !== null && state.lockedUntil > now) {
    return { locked: true, remainingMs: state.lockedUntil - now }
  }
  return { locked: false, remainingMs: 0 }
}

/** On the 5th consecutive failure, locks out and resets the counter for the next window. */
export function nextStateAfterFailure(state: LockoutState, now: number): LockoutState {
  const attempts = state.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    return { attempts: 0, lockedUntil: now + COOLDOWN_MS }
  }
  return { attempts, lockedUntil: state.lockedUntil }
}

export function stateAfterSuccess(): LockoutState {
  return EMPTY_STATE
}

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
}

function readState(email: string): LockoutState {
  try {
    const raw = localStorage.getItem(storageKey(email))
    return raw ? (JSON.parse(raw) as LockoutState) : EMPTY_STATE
  } catch {
    return EMPTY_STATE
  }
}

function writeState(email: string, state: LockoutState): void {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(state))
  } catch {
    // localStorage unavailable — lockout just won't persist across reloads, non-fatal
  }
}

export function getLockoutStatus(email: string, now: number = Date.now()): LockoutStatus {
  return computeLockoutStatus(readState(email), now)
}

export function recordFailedLoginAttempt(email: string, now: number = Date.now()): void {
  writeState(email, nextStateAfterFailure(readState(email), now))
}

export function recordSuccessfulLogin(email: string): void {
  writeState(email, stateAfterSuccess())
}
