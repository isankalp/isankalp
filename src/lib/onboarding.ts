const KEY = 'goals-tracker:onboarded'

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return true
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(KEY, 'true')
  } catch {
    // localStorage unavailable — non-fatal, wizard may reappear next load
  }
}
