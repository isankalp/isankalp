import { useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { PRIORITIES, UNIT_TYPES, isCustomUnitValid, unitLabel, type Priority, type UnitType } from '../db/models'

const UNIT_SELECT_LABELS: Record<UnitType, string> = {
  minutes: 'Minutes',
  pages: 'Pages',
  reps: 'Reps',
  dollars: 'Dollars',
  custom: 'Custom',
}

/** WT-1/WT-2: the same fields and validations as the daily AddTaskForm (title, unit, amount per
 *  subtask, total subtasks, priority) — notes, tags and named subtasks are set afterward on the row
 *  itself, exactly as on the daily Tasks screen, so they're intentionally not part of this form either. */
export default function WeeklyAddTaskForm({ planId }: { planId: string }) {
  const [title, setTitle] = useState('')
  const [minutesPerSubtask, setMinutesPerSubtask] = useState('')
  const [totalSubtasks, setTotalSubtasks] = useState('')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [unit, setUnit] = useState<UnitType>('minutes')
  const [customUnitLabel, setCustomUnitLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function readValidatedFields(): { minutes: number; total: number } | null {
    const minutes = Number(minutesPerSubtask)
    const total = Number(totalSubtasks)
    if (!title.trim()) {
      setError('Title is required.')
      return null
    }
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(total) || total <= 0) {
      setError('Amount per subtask and total subtasks must be greater than 0.')
      return null
    }
    if (!isCustomUnitValid(unit, customUnitLabel)) {
      setError('Enter a label for your custom unit.')
      return null
    }
    setError(null)
    return { minutes, total }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fields = readValidatedFields()
    if (!fields) return

    const now = Date.now()
    await db.weeklyTasks.add({
      id: uuid(),
      title: title.trim(),
      planId,
      minutesPerSubtask: fields.minutes,
      totalSubtasks: Math.floor(fields.total),
      completedSubtasks: 0,
      priority,
      unit,
      customUnitLabel: unit === 'custom' ? customUnitLabel.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    })

    setTitle('')
    setMinutesPerSubtask('')
    setTotalSubtasks('')
    setPriority('Medium')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-1.5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1.5">
        <input
          type="text"
          placeholder="Task title (e.g. Solve DSA questions)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs sm:col-span-1"
        />
        <input
          type="number"
          placeholder="Amount/subtask"
          value={minutesPerSubtask}
          onChange={(e) => setMinutesPerSubtask(e.target.value)}
          min={1}
          step="any"
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-32"
        />
        <input
          type="number"
          placeholder="Total subtasks"
          value={totalSubtasks}
          onChange={(e) => setTotalSubtasks(e.target.value)}
          min={1}
          step={1}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-32"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          aria-label="Priority"
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitType)}
          aria-label="Unit"
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
        >
          {UNIT_TYPES.map((u) => (
            <option key={u} value={u}>
              {UNIT_SELECT_LABELS[u]}
            </option>
          ))}
        </select>
        {unit === 'custom' && (
          <input
            type="text"
            value={customUnitLabel}
            onChange={(e) => setCustomUnitLabel(e.target.value)}
            placeholder="e.g. calories"
            maxLength={20}
            aria-label="Custom unit label"
            className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-28"
          />
        )}
        {Number(minutesPerSubtask) > 0 && Number(totalSubtasks) > 0 && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {minutesPerSubtask} {unitLabel({ unit, customUnitLabel })} &times; {totalSubtasks} ={' '}
            {Number(minutesPerSubtask) * Number(totalSubtasks)} {unitLabel({ unit, customUnitLabel })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          Add Task
        </button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  )
}
