/** Format a Date as a local YYYY-MM-DD string (no UTC shifting). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, delta: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + delta)
  return toDateKey(date)
}

export function addMonths(key: string, delta: number): string {
  const date = parseDateKey(key)
  date.setDate(1)
  date.setMonth(date.getMonth() + delta)
  return toDateKey(date)
}

export function formatDisplayDate(key: string): string {
  const date = parseDateKey(key)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function isToday(key: string): boolean {
  return key === todayKey()
}

export function isPast(key: string): boolean {
  return key < todayKey()
}

export function startOfMonth(key: string): Date {
  const date = parseDateKey(key)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Build a 6x7 calendar grid (Sunday-first) of date keys for the month containing `key`. */
export function monthGrid(key: string): string[] {
  const first = startOfMonth(key)
  const gridStart = new Date(first)
  gridStart.setDate(gridStart.getDate() - first.getDay())
  const days: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(toDateKey(d))
  }
  return days
}
