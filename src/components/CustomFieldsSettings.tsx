import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { deleteCustomField, isDuplicateFieldName } from '../lib/customFields'
import type { CustomFieldType } from '../db/models'

export default function CustomFieldsSettings() {
  const fields = useLiveQuery(() => db.customFields.toArray(), []) ?? []
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [optionsInput, setOptionsInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) return
    if (isDuplicateFieldName(name, fields)) {
      setError('A custom field with that name already exists.')
      return
    }
    const options = type === 'dropdown' ? optionsInput.split(',').map((o) => o.trim()).filter(Boolean) : undefined
    if (type === 'dropdown' && (!options || options.length === 0)) {
      setError('Add at least one option for a dropdown field.')
      return
    }
    await db.customFields.add({ id: uuid(), name: name.trim(), type, options, createdAt: Date.now() })
    setName('')
    setOptionsInput('')
    setType('text')
    setError(null)
  }

  async function handleDelete(fieldId: string, eraseValues: boolean) {
    await deleteCustomField(fieldId, eraseValues)
    setConfirmDeleteId(null)
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3">
      {fields.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">No custom fields yet.</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-xs p-2 rounded-md border border-slate-200 dark:border-slate-700">
              <span>
                {f.name} <span className="text-slate-400">({f.type})</span>
                {f.options && <span className="text-slate-400"> — {f.options.join(', ')}</span>}
              </span>
              {confirmDeleteId === f.id ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Delete field —</span>
                  <button type="button" onClick={() => handleDelete(f.id, false)} className="underline font-medium">
                    keep values
                  </button>
                  <button type="button" onClick={() => handleDelete(f.id, true)} className="underline font-medium text-red-600 dark:text-red-400">
                    delete values too
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-slate-400">
                    cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(f.id)}
                  aria-label={`Delete custom field ${f.name}`}
                  className="text-slate-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-1.5">
        <label className="text-xs">
          <span className="block text-slate-500 dark:text-slate-400">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </label>
        <label className="text-xs">
          <span className="block text-slate-500 dark:text-slate-400">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            className="mt-0.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="dropdown">Dropdown</option>
          </select>
        </label>
        {type === 'dropdown' && (
          <label className="text-xs flex-1 min-w-[8rem]">
            <span className="block text-slate-500 dark:text-slate-400">Options (comma-separated)</span>
            <input
              type="text"
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              placeholder="e.g. Low, Medium, High"
              className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </label>
        )}
        <button type="button" onClick={handleAdd} className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
          Add Field
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
