import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { Goal } from '../db/models'
import { searchGoalTemplates, type GoalTemplate } from '../lib/goalTemplates'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function TemplateEditor({ template, onCancel, onCreated }: { template: GoalTemplate; onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(template.title)
  const [minutesPerSubtask, setMinutesPerSubtask] = useState(String(template.defaultMinutesPerSubtask))
  const [totalSubtasks, setTotalSubtasks] = useState(String(template.defaultTotalSubtasks))
  const [weekdays, setWeekdays] = useState<number[]>(template.recurrenceWeekdays)

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  async function handleCreate() {
    const minutes = Number(minutesPerSubtask)
    const total = Number(totalSubtasks)
    if (!title.trim() || !Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(total) || total <= 0) return

    const goal: Goal = { id: uuid(), title: title.trim(), linkedTaskTitles: [title.trim()] }
    await db.goals.add(goal)
    await db.templates.add({
      id: uuid(),
      title: title.trim(),
      minutesPerSubtask: minutes,
      totalSubtasks: Math.floor(total),
      recurrenceWeekdays: weekdays,
      createdAt: Date.now(),
    })
    onCreated()
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs">
        <span className="text-slate-500 dark:text-slate-400">Goal / task title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
        />
      </label>
      <div className="flex gap-2">
        <label className="text-xs flex-1">
          <span className="text-slate-500 dark:text-slate-400">Min/subtask</span>
          <input
            type="number"
            value={minutesPerSubtask}
            onChange={(e) => setMinutesPerSubtask(e.target.value)}
            min={0.1}
            step="any"
            className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </label>
        <label className="text-xs flex-1">
          <span className="text-slate-500 dark:text-slate-400">Total subtasks</span>
          <input
            type="number"
            value={totalSubtasks}
            onChange={(e) => setTotalSubtasks(e.target.value)}
            min={1}
            step={1}
            className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </label>
      </div>
      <div>
        <span className="text-xs text-slate-500 dark:text-slate-400">Auto-add on:</span>
        <div className="flex gap-1 mt-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleWeekday(i)}
              className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
                weekdays.includes(i)
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleCreate} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          Create Goal
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700">
          Back
        </button>
      </div>
    </div>
  )
}

export default function TemplateLibrary({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<GoalTemplate | null>(null)
  const results = searchGoalTemplates(query)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">New Goal from Template</h3>
          <button type="button" onClick={onClose} aria-label="Close template library" className="text-slate-400 hover:text-slate-600 text-sm">
            ✕
          </button>
        </div>

        {selected ? (
          <TemplateEditor template={selected} onCancel={() => setSelected(null)} onCreated={onClose} />
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              aria-label="Search goal templates"
              className="w-full mb-3 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
            />
            {results.length === 0 ? (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-8">
                No templates match —{' '}
                <button type="button" onClick={onClose} className="underline font-medium">
                  create your own goal instead
                </button>
                .
              </p>
            ) : (
              <ul className="space-y-1.5">
                {results.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(t)}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
