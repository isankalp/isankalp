import type { LifestyleEntry, LifestyleField } from '../db/models'

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Epic 70. `sameDay` (ST-3) turns off the overnight assumption entirely — end must be later than
 * start, or the entry is invalid. Otherwise (ST-2) a numerically-earlier end wraps to the next
 * calendar day via modulo, which also correctly handles a same-evening pair that doesn't wrap.
 * ST-4: identical times are never meaningful (a zero-length sleep), so they're rejected either way.
 */
export function calculateDurationMinutes(startTime: string, endTime: string, sameDay: boolean): number | null {
  if (!startTime || !endTime) return null
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (start === end) return null
  if (sameDay) return end > start ? end - start : null
  return (((end - start) % 1440) + 1440) % 1440
}

export const LIFESTYLE_FIELD_TYPE_LABELS: Record<LifestyleField['type'], string> = {
  boolean: 'Yes/No',
  duration: 'Duration',
  number: 'Number',
}

function evaluateBoolean(field: LifestyleField, entry: Pick<LifestyleEntry, 'boolValue' | 'countValue'>): boolean {
  if (entry.boolValue !== field.booleanExpected) return false
  if (field.booleanCountEnabled && field.booleanCountMax !== undefined) {
    if (entry.countValue === undefined || entry.countValue > field.booleanCountMax) return false
  }
  return true
}

function evaluateDuration(field: LifestyleField, durationMinutes: number | null | undefined): boolean {
  if (durationMinutes === null || durationMinutes === undefined) return false
  if (field.durationMinMinutes !== undefined && durationMinutes < field.durationMinMinutes) return false
  if (field.durationMaxMinutes !== undefined && durationMinutes > field.durationMaxMinutes) return false
  return true
}

function evaluateNumber(field: LifestyleField, value: number | undefined): boolean {
  if (value === undefined || !Number.isFinite(value)) return false
  if (field.numberMin !== undefined && value < field.numberMin) return false
  if (field.numberMax !== undefined && value > field.numberMax) return false
  return true
}

/** Epic 69/LE-6: evaluates one day's entered value against its field's current threshold. The
 *  result is meant to be stored on the LifestyleEntry at save time (LF-4: a later threshold edit
 *  must never retroactively change what's already been evaluated and saved). */
export function evaluateLifestyleEntry(
  field: LifestyleField,
  entry: Pick<LifestyleEntry, 'boolValue' | 'countValue' | 'durationMinutes' | 'numberValue'>,
): boolean {
  switch (field.type) {
    case 'boolean':
      return evaluateBoolean(field, entry)
    case 'duration':
      return evaluateDuration(field, entry.durationMinutes)
    case 'number':
      return evaluateNumber(field, entry.numberValue)
  }
}

export type LifestyleDayState = 'pass' | 'fail' | 'none'

/** Epic 71 (LV-2/LV-3/LV-4): green only if there's a passing entry for every currently-active
 *  field; any entry missing or failed is red; zero entries at all is neutral. */
export function lifestyleDayState(entries: LifestyleEntry[], activeFieldIds: string[]): LifestyleDayState {
  if (entries.length === 0) return 'none'
  const entriesByField = new Map(entries.map((e) => [e.fieldId, e]))
  const allPassed = activeFieldIds.every((id) => entriesByField.get(id)?.passed === true)
  return allPassed ? 'pass' : 'fail'
}

/** LF-6: rejects a name that collides (case-insensitively) with another active field. */
export function isDuplicateFieldName(name: string, existingFields: LifestyleField[], excludeId?: string): boolean {
  const trimmed = name.trim().toLowerCase()
  return existingFields.some((f) => !f.archivedAt && f.id !== excludeId && f.name.trim().toLowerCase() === trimmed)
}
