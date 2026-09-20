import { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { LIFESTYLE_FIELD_TYPE_LABELS, isDuplicateFieldName } from '../lib/lifestyle'
import type { LifestyleField, LifestyleFieldType } from '../db/models'

interface DraftField {
  name: string
  type: LifestyleFieldType
  booleanExpected: boolean
  booleanCountEnabled: boolean
  booleanCountMax: string
  durationAutoCalc: boolean
  durationStartLabel: string
  durationEndLabel: string
  durationMinMinutes: string
  durationMaxMinutes: string
  numberMin: string
  numberMax: string
}

const EMPTY_DRAFT: DraftField = {
  name: '',
  type: 'boolean',
  booleanExpected: true,
  booleanCountEnabled: false,
  booleanCountMax: '',
  durationAutoCalc: true,
  durationStartLabel: 'Sleep Time',
  durationEndLabel: 'Wake Time',
  durationMinMinutes: '',
  durationMaxMinutes: '',
  numberMin: '',
  numberMax: '',
}

function draftFromField(f: LifestyleField): DraftField {
  return {
    name: f.name,
    type: f.type,
    booleanExpected: f.booleanExpected ?? true,
    booleanCountEnabled: f.booleanCountEnabled ?? false,
    booleanCountMax: f.booleanCountMax !== undefined ? String(f.booleanCountMax) : '',
    durationAutoCalc: f.durationAutoCalc ?? true,
    durationStartLabel: f.durationStartLabel ?? 'Sleep Time',
    durationEndLabel: f.durationEndLabel ?? 'Wake Time',
    durationMinMinutes: f.durationMinMinutes !== undefined ? String(f.durationMinMinutes) : '',
    durationMaxMinutes: f.durationMaxMinutes !== undefined ? String(f.durationMaxMinutes) : '',
    numberMin: f.numberMin !== undefined ? String(f.numberMin) : '',
    numberMax: f.numberMax !== undefined ? String(f.numberMax) : '',
  }
}

function thresholdSummary(f: LifestyleField): string {
  if (f.type === 'boolean') {
    const base = `expect ${f.booleanExpected ? 'Yes' : 'No'}`
    return f.booleanCountEnabled && f.booleanCountMax !== undefined ? `${base}, up to ${f.booleanCountMax}×` : base
  }
  if (f.type === 'duration') {
    const min = f.durationMinMinutes !== undefined ? `${Math.round(f.durationMinMinutes / 60)}h` : null
    const max = f.durationMaxMinutes !== undefined ? `${Math.round(f.durationMaxMinutes / 60)}h` : null
    const range = min && max ? `${min}–${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : 'no range set'
    return f.durationAutoCalc ? `${range} (from ${f.durationStartLabel}/${f.durationEndLabel})` : range
  }
  const min = f.numberMin !== undefined ? `≥ ${f.numberMin}` : null
  const max = f.numberMax !== undefined ? `≤ ${f.numberMax}` : null
  return [min, max].filter(Boolean).join(', ') || 'no limit set'
}

export default function LifestyleFieldConfigView() {
  const allFields = useLiveQuery(() => db.lifestyleFields.toArray(), []) ?? []
  const fields = allFields.filter((f) => !f.archivedAt).sort((a, b) => a.order - b.order)

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<DraftField>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function startAdd() {
    setDraft(EMPTY_DRAFT)
    setError(null)
    setEditingId('new')
  }

  function startEdit(field: LifestyleField) {
    setDraft(draftFromField(field))
    setError(null)
    setEditingId(field.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function handleSave() {
    const name = draft.name.trim()
    if (!name) {
      setError('Name is required.')
      return
    }
    if (isDuplicateFieldName(name, allFields, editingId === 'new' ? undefined : (editingId ?? undefined))) {
      setError('A field with that name already exists.')
      return
    }
    if (draft.type === 'number') {
      const min = draft.numberMin ? Number(draft.numberMin) : undefined
      const max = draft.numberMax ? Number(draft.numberMax) : undefined
      if (min !== undefined && max !== undefined && min > max) {
        setError('Min cannot be greater than max.')
        return
      }
    }
    if (draft.type === 'duration') {
      const min = draft.durationMinMinutes ? Number(draft.durationMinMinutes) : undefined
      const max = draft.durationMaxMinutes ? Number(draft.durationMaxMinutes) : undefined
      if (min !== undefined && max !== undefined && min > max) {
        setError('Min cannot be greater than max.')
        return
      }
      if (draft.durationAutoCalc && (!draft.durationStartLabel.trim() || !draft.durationEndLabel.trim())) {
        setError('Label both times for an auto-calculated duration field.')
        return
      }
    }

    const patch: Partial<LifestyleField> = {
      name,
      type: draft.type,
      updatedAt: Date.now(),
      booleanExpected: draft.type === 'boolean' ? draft.booleanExpected : undefined,
      booleanCountEnabled: draft.type === 'boolean' ? draft.booleanCountEnabled : undefined,
      booleanCountMax:
        draft.type === 'boolean' && draft.booleanCountEnabled && draft.booleanCountMax
          ? Number(draft.booleanCountMax)
          : undefined,
      durationAutoCalc: draft.type === 'duration' ? draft.durationAutoCalc : undefined,
      durationStartLabel: draft.type === 'duration' && draft.durationAutoCalc ? draft.durationStartLabel.trim() : undefined,
      durationEndLabel: draft.type === 'duration' && draft.durationAutoCalc ? draft.durationEndLabel.trim() : undefined,
      durationMinMinutes: draft.type === 'duration' && draft.durationMinMinutes ? Number(draft.durationMinMinutes) : undefined,
      durationMaxMinutes: draft.type === 'duration' && draft.durationMaxMinutes ? Number(draft.durationMaxMinutes) : undefined,
      numberMin: draft.type === 'number' && draft.numberMin ? Number(draft.numberMin) : undefined,
      numberMax: draft.type === 'number' && draft.numberMax ? Number(draft.numberMax) : undefined,
    }

    if (editingId === 'new') {
      await db.lifestyleFields.add({
        id: uuid(),
        order: fields.length,
        createdAt: Date.now(),
        ...patch,
      } as LifestyleField)
    } else if (editingId) {
      // LF-4: editing only ever changes the field's row — past LifestyleEntry.passed values were
      // frozen at save time and are never touched here.
      await db.lifestyleFields.update(editingId, patch)
    }
    setEditingId(null)
    setError(null)
  }

  async function handleDelete(id: string) {
    // LF-5: soft-delete only — historical entries keep referencing this row for name/type/threshold.
    await db.lifestyleFields.update(id, { archivedAt: Date.now() })
    setConfirmDeleteId(null)
  }

  async function move(field: LifestyleField, direction: -1 | 1) {
    const index = fields.findIndex((f) => f.id === field.id)
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= fields.length) return
    const other = fields[swapWith]
    await db.lifestyleFields.update(field.id, { order: other.order })
    await db.lifestyleFields.update(other.id, { order: field.order })
  }

  return (
    <div>
      <h3 className="font-semibold text-sm mb-2">Lifestyle Fields</h3>

      {fields.length === 0 && editingId === null ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">No fields yet — add your first one (e.g. Sleep, Screen Time).</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {fields.map((f, i) => (
            <li key={f.id} className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{f.name}</span>{' '}
                  <span className="text-slate-400">({LIFESTYLE_FIELD_TYPE_LABELS[f.type]})</span>
                  <p className="text-slate-500 dark:text-slate-400 truncate">{thresholdSummary(f)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(f, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${f.name} up`}
                    className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(f, 1)}
                    disabled={i === fields.length - 1}
                    aria-label={`Move ${f.name} down`}
                    className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(f)}
                    className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600"
                  >
                    Edit
                  </button>
                  {confirmDeleteId === f.id ? (
                    <>
                      <button type="button" onClick={() => handleDelete(f.id)} className="underline font-medium text-red-600 dark:text-red-400">
                        Confirm
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-slate-400">
                        cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(f.id)}
                      aria-label={`Delete field ${f.name}`}
                      className="text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingId === null ? (
        <button type="button" onClick={startAdd} className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
          + Add Field
        </button>
      ) : (
        <div className="p-2.5 rounded-md border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 space-y-2 text-xs">
          <div className="flex flex-wrap items-end gap-1.5">
            <label>
              <span className="block text-slate-500 dark:text-slate-400">Name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={40}
                className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </label>
            <label>
              <span className="block text-slate-500 dark:text-slate-400">Type</span>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as LifestyleFieldType }))}
                disabled={editingId !== 'new'}
                className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 disabled:opacity-60"
              >
                <option value="boolean">Yes/No</option>
                <option value="duration">Duration</option>
                <option value="number">Number</option>
              </select>
            </label>
          </div>

          {draft.type === 'boolean' && (
            <div className="flex flex-wrap items-end gap-1.5">
              <label>
                <span className="block text-slate-500 dark:text-slate-400">Success means</span>
                <select
                  value={draft.booleanExpected ? 'yes' : 'no'}
                  onChange={(e) => setDraft((d) => ({ ...d, booleanExpected: e.target.value === 'yes' }))}
                  className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="yes">Checked (Yes)</option>
                  <option value="no">Unchecked (No)</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 pb-1.5">
                <input
                  type="checkbox"
                  checked={draft.booleanCountEnabled}
                  onChange={(e) => setDraft((d) => ({ ...d, booleanCountEnabled: e.target.checked }))}
                />
                <span className="text-slate-500 dark:text-slate-400">Count if yes</span>
              </label>
              {draft.booleanCountEnabled && (
                <label>
                  <span className="block text-slate-500 dark:text-slate-400">Max count</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.booleanCountMax}
                    onChange={(e) => setDraft((d) => ({ ...d, booleanCountMax: e.target.value }))}
                    className="mt-0.5 w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </label>
              )}
            </div>
          )}

          {draft.type === 'duration' && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.durationAutoCalc}
                  onChange={(e) => setDraft((d) => ({ ...d, durationAutoCalc: e.target.checked }))}
                />
                <span className="text-slate-500 dark:text-slate-400">Auto-calculate from two times</span>
              </label>
              {draft.durationAutoCalc && (
                <div className="flex flex-wrap items-end gap-1.5">
                  <label>
                    <span className="block text-slate-500 dark:text-slate-400">Start label</span>
                    <input
                      type="text"
                      value={draft.durationStartLabel}
                      onChange={(e) => setDraft((d) => ({ ...d, durationStartLabel: e.target.value }))}
                      className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                    />
                  </label>
                  <label>
                    <span className="block text-slate-500 dark:text-slate-400">End label</span>
                    <input
                      type="text"
                      value={draft.durationEndLabel}
                      onChange={(e) => setDraft((d) => ({ ...d, durationEndLabel: e.target.value }))}
                      className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-1.5">
                <label>
                  <span className="block text-slate-500 dark:text-slate-400">Min (minutes)</span>
                  <input
                    type="number"
                    value={draft.durationMinMinutes}
                    onChange={(e) => setDraft((d) => ({ ...d, durationMinMinutes: e.target.value }))}
                    className="mt-0.5 w-24 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </label>
                <label>
                  <span className="block text-slate-500 dark:text-slate-400">Max (minutes)</span>
                  <input
                    type="number"
                    value={draft.durationMaxMinutes}
                    onChange={(e) => setDraft((d) => ({ ...d, durationMaxMinutes: e.target.value }))}
                    className="mt-0.5 w-24 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </label>
              </div>
            </div>
          )}

          {draft.type === 'number' && (
            <div className="flex flex-wrap items-end gap-1.5">
              <label>
                <span className="block text-slate-500 dark:text-slate-400">Min</span>
                <input
                  type="number"
                  value={draft.numberMin}
                  onChange={(e) => setDraft((d) => ({ ...d, numberMin: e.target.value }))}
                  className="mt-0.5 w-24 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </label>
              <label>
                <span className="block text-slate-500 dark:text-slate-400">Max</span>
                <input
                  type="number"
                  value={draft.numberMax}
                  onChange={(e) => setDraft((d) => ({ ...d, numberMax: e.target.value }))}
                  className="mt-0.5 w-24 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </label>
            </div>
          )}

          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handleSave} className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700">
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
