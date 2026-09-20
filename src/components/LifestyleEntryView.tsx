import { useEffect, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { calculateDurationMinutes, evaluateLifestyleEntry, formatDurationMinutes } from '../lib/lifestyle'
import type { LifestyleEntry, LifestyleField } from '../db/models'

interface FieldDraft {
  boolValue: boolean
  countValue: string
  startTime: string
  endTime: string
  sameDay: boolean
  durationMinutes: string
  numberValue: string
}

function emptyDraft(): FieldDraft {
  return { boolValue: false, countValue: '', startTime: '', endTime: '', sameDay: false, durationMinutes: '', numberValue: '' }
}

function draftFromEntry(e: LifestyleEntry | undefined, autoCalc: boolean): FieldDraft {
  if (!e) return emptyDraft()
  return {
    boolValue: e.boolValue ?? false,
    countValue: e.countValue !== undefined ? String(e.countValue) : '',
    startTime: e.startTime ?? '',
    endTime: e.endTime ?? '',
    sameDay: e.sameDay ?? false,
    durationMinutes: !autoCalc && e.durationMinutes !== undefined ? String(e.durationMinutes) : '',
    numberValue: e.numberValue !== undefined ? String(e.numberValue) : '',
  }
}

export default function LifestyleEntryView({
  date,
  onDirtyChange,
}: {
  date: string
  onDirtyChange: (dirty: boolean) => void
}) {
  const fieldsRaw = useLiveQuery(() => db.lifestyleFields.toArray(), [])
  const existingEntries = useLiveQuery(() => db.lifestyleEntries.where('date').equals(date).toArray(), [date])
  const loading = fieldsRaw === undefined || existingEntries === undefined
  const fields = (fieldsRaw ?? []).filter((f) => !f.archivedAt).sort((a, b) => a.order - b.order)

  const [draft, setDraft] = useState<Record<string, FieldDraft>>({})
  const [seededFor, setSeededFor] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (loading) return
    const byField = new Map((existingEntries ?? []).map((e) => [e.fieldId, e]))
    const next: Record<string, FieldDraft> = {}
    for (const f of fields) next[f.id] = draftFromEntry(byField.get(f.id), f.durationAutoCalc ?? true)
    setDraft(next)
    setErrors({})
    setSeededFor(date)
    onDirtyChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed only on date change or initial load, not every keystroke's live-query tick
  }, [date, loading])

  function updateDraft(fieldId: string, patch: Partial<FieldDraft>) {
    setDraft((prev) => ({ ...prev, [fieldId]: { ...(prev[fieldId] ?? emptyDraft()), ...patch } }))
    onDirtyChange(true)
    setSaved(false)
  }

  async function handleSave() {
    const nextErrors: Record<string, string> = {}
    const writes: LifestyleEntry[] = []
    const deletes: string[] = []
    const now = Date.now()
    const existingByField = new Map((existingEntries ?? []).map((e) => [e.fieldId, e]))

    for (const field of fields) {
      const d = draft[field.id] ?? emptyDraft()
      const existing = existingByField.get(field.id)

      if (field.type === 'boolean') {
        const countValue = field.booleanCountEnabled && d.boolValue && d.countValue ? Number(d.countValue) : undefined
        if (field.booleanCountEnabled && d.boolValue && d.countValue && !Number.isFinite(countValue)) {
          nextErrors[field.id] = 'Count must be a number.'
          continue
        }
        writes.push({
          id: existing?.id ?? uuid(),
          date,
          fieldId: field.id,
          updatedAt: now,
          passed: evaluateLifestyleEntry(field, { boolValue: d.boolValue, countValue }),
          boolValue: d.boolValue,
          countValue,
        })
        continue
      }

      if (field.type === 'duration') {
        const hasInput = field.durationAutoCalc ? d.startTime || d.endTime : d.durationMinutes
        if (!hasInput) {
          if (existing) deletes.push(existing.id)
          continue
        }
        let minutes: number
        if (field.durationAutoCalc) {
          if (!d.startTime || !d.endTime) {
            nextErrors[field.id] = 'Enter both times.'
            continue
          }
          const calculated = calculateDurationMinutes(d.startTime, d.endTime, d.sameDay)
          if (calculated === null) {
            nextErrors[field.id] = d.sameDay
              ? 'A same-day entry must end after it starts.'
              : 'Start and end time cannot be identical.'
            continue
          }
          minutes = calculated
        } else {
          const n = Number(d.durationMinutes)
          if (!Number.isFinite(n) || n <= 0) {
            nextErrors[field.id] = 'Enter a valid duration in minutes.'
            continue
          }
          minutes = n
        }
        writes.push({
          id: existing?.id ?? uuid(),
          date,
          fieldId: field.id,
          updatedAt: now,
          passed: evaluateLifestyleEntry(field, { durationMinutes: minutes }),
          startTime: field.durationAutoCalc ? d.startTime : undefined,
          endTime: field.durationAutoCalc ? d.endTime : undefined,
          sameDay: field.durationAutoCalc ? d.sameDay : undefined,
          durationMinutes: minutes,
        })
        continue
      }

      // number
      if (!d.numberValue) {
        if (existing) deletes.push(existing.id)
        continue
      }
      const n = Number(d.numberValue)
      if (!Number.isFinite(n)) {
        nextErrors[field.id] = 'Enter a valid number.'
        continue
      }
      writes.push({
        id: existing?.id ?? uuid(),
        date,
        fieldId: field.id,
        updatedAt: now,
        passed: evaluateLifestyleEntry(field, { numberValue: n }),
        numberValue: n,
      })
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    await db.transaction('rw', db.lifestyleEntries, async () => {
      for (const id of deletes) await db.lifestyleEntries.delete(id)
      for (const w of writes) await db.lifestyleEntries.put(w)
    })
    onDirtyChange(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (loading || seededFor !== date) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (fields.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">No lifestyle fields configured yet — set some up.</p>
  }

  return (
    <div>
      <div className="space-y-2 mb-3">
        {fields.map((field) => (
          <LifestyleFieldRow
            key={field.id}
            field={field}
            draft={draft[field.id] ?? emptyDraft()}
            error={errors[field.id]}
            onChange={(patch) => updateDraft(field.id, patch)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleSave} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          Save
        </button>
        {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}

function LifestyleFieldRow({
  field,
  draft,
  error,
  onChange,
}: {
  field: LifestyleField
  draft: FieldDraft
  error?: string
  onChange: (patch: Partial<FieldDraft>) => void
}) {
  const calculatedMinutes =
    field.type === 'duration' && field.durationAutoCalc ? calculateDurationMinutes(draft.startTime, draft.endTime, draft.sameDay) : null

  return (
    <div className="p-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <p className="text-xs font-medium mb-1.5">{field.name}</p>

      {field.type === 'boolean' && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={draft.boolValue}
              onChange={(e) => onChange({ boolValue: e.target.checked, countValue: e.target.checked ? draft.countValue : '' })}
            />
            Yes
          </label>
          {field.booleanCountEnabled && draft.boolValue && (
            <label className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Count</span>
              <input
                type="number"
                min={0}
                value={draft.countValue}
                onChange={(e) => onChange({ countValue: e.target.value })}
                className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </label>
          )}
        </div>
      )}

      {field.type === 'duration' && field.durationAutoCalc && (
        <div className="text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400">{field.durationStartLabel}</span>
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => onChange({ startTime: e.target.value })}
                className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400">{field.durationEndLabel}</span>
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) => onChange({ endTime: e.target.value })}
                className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={draft.sameDay} onChange={(e) => onChange({ sameDay: e.target.checked })} />
              <span className="text-slate-500 dark:text-slate-400">Same day (nap)</span>
            </label>
          </div>
          {calculatedMinutes !== null && <p className="mt-1 text-slate-500 dark:text-slate-400">= {formatDurationMinutes(calculatedMinutes)}</p>}
        </div>
      )}

      {field.type === 'duration' && !field.durationAutoCalc && (
        <input
          type="number"
          min={0}
          value={draft.durationMinutes}
          onChange={(e) => onChange({ durationMinutes: e.target.value })}
          placeholder="minutes"
          className="w-24 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={draft.numberValue}
          onChange={(e) => onChange({ numberValue: e.target.value })}
          className="w-24 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
        />
      )}

      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
