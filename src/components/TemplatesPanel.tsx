import { useLiveQuery } from '../hooks/useLiveQuery'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { unitLabel } from '../db/models'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function recurrenceLabel(weekdays: number[]): string {
  if (weekdays.length === 0) return 'One-off'
  return [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(', ')
}

export default function TemplatesPanel({ date, onClose }: { date: string; onClose: () => void }) {
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? []
  const active = templates.filter((t) => !t.archivedAt)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function addToToday(templateId: string) {
    const template = active.find((t) => t.id === templateId)
    if (!template) return
    if (template.minutesPerSubtask <= 0 || template.totalSubtasks <= 0) {
      setError('This template has invalid values and cannot be added.')
      return
    }
    setError(null)
    const day = await getOrCreateDay(date)
    const now = Date.now()
    await db.tasks.add({
      id: uuid(),
      title: template.title,
      dayId: day.id,
      minutesPerSubtask: template.minutesPerSubtask,
      totalSubtasks: template.totalSubtasks,
      completedSubtasks: 0,
      priority: 'Medium',
      templateId: template.id,
      unit: template.unit,
      customUnitLabel: template.customUnitLabel,
      createdAt: now,
      updatedAt: now,
    })
    onClose()
  }

  async function toggleWeekday(templateId: string, weekday: number) {
    const template = active.find((t) => t.id === templateId)
    if (!template) return
    const has = template.recurrenceWeekdays.includes(weekday)
    const recurrenceWeekdays = has
      ? template.recurrenceWeekdays.filter((d) => d !== weekday)
      : [...template.recurrenceWeekdays, weekday]
    await db.templates.update(templateId, { recurrenceWeekdays })
  }

  async function deleteTemplate(templateId: string) {
    await db.templates.update(templateId, { archivedAt: Date.now() })
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Templates</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">
          ✕ Close
        </button>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}

      {active.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No templates saved — save one from any task above.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((template) => (
            <li key={template.id} className="p-2 rounded-md border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{template.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {template.minutesPerSubtask} {unitLabel(template)} &times; {template.totalSubtasks} subtasks &middot;{' '}
                    {recurrenceLabel(template.recurrenceWeekdays)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => addToToday(template.id)}
                    className="px-2 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700"
                  >
                    Add to Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId((id) => (id === template.id ? null : template.id))}
                    aria-label={`Edit recurrence for ${template.title}`}
                    className="text-slate-400 hover:text-indigo-600 text-xs"
                  >
                    ⚙
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.id)}
                    aria-label={`Delete template ${template.title}`}
                    className="text-slate-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {editingId === template.id && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {WEEKDAY_LABELS.map((label, weekday) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleWeekday(template.id, weekday)}
                      className={
                        template.recurrenceWeekdays.includes(weekday)
                          ? 'text-[11px] px-2 py-0.5 rounded-full bg-indigo-600 text-white'
                          : 'text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
