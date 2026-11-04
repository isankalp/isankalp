import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import type { Task } from '../db/models'

/** CF-2/3: per-task custom field values, shown only in this expandable detail panel — never the compact row. */
export default function TaskCustomFields({ task }: { task: Task }) {
  const fields = useLiveQuery(() => db.customFields.toArray(), []) ?? []
  if (fields.length === 0) return null

  async function commitValue(fieldId: string, value: string) {
    const current = task.customFieldValues ?? {}
    const next = { ...current, [fieldId]: value }
    if (!value) delete next[fieldId]
    await db.tasks.update(task.id, { customFieldValues: next })
  }

  return (
    <div className="mt-2 p-2 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 space-y-1.5">
      {fields.map((f) => {
        const value = task.customFieldValues?.[f.id]
        return (
          <label key={f.id} className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 w-20 shrink-0">{f.name}</span>
            {f.type === 'dropdown' ? (
              <select
                defaultValue={value ?? ''}
                onChange={(e) => commitValue(f.id, e.target.value)}
                aria-label={f.name}
                className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                defaultValue={value ?? ''}
                key={`${f.id}-${value ?? ''}`}
                onBlur={(e) => commitValue(f.id, e.target.value)}
                aria-label={f.name}
                className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            )}
          </label>
        )
      })}
    </div>
  )
}
