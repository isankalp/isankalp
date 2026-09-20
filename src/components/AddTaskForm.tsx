import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { PRIORITIES, UNIT_TYPES, isCustomUnitValid, unitLabel, type Priority, type UnitType } from '../db/models'
import { useT } from '../lib/i18n'
import { useSettings } from '../context/SettingsContext'
import { capacityPercent, checkCapacity, isCapacityEnabled } from '../lib/capacity'
import { addDays } from '../lib/date'
import { weekStart } from '../lib/aggregate'

export interface AddTaskPrefill {
  title: string
  minutesPerSubtask?: number
  totalSubtasks?: number
}

const UNIT_SELECT_LABELS: Record<UnitType, string> = {
  minutes: 'Minutes',
  pages: 'Pages',
  reps: 'Reps',
  dollars: 'Dollars',
  custom: 'Custom',
}

export default function AddTaskForm({
  defaultDate,
  onToggleTemplates,
  prefill,
}: {
  defaultDate: string
  onToggleTemplates?: () => void
  /** Pre-fills the form, e.g. from a Quick-Add parse that couldn't be fully resolved (QA-2). */
  prefill?: AddTaskPrefill
}) {
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [minutesPerSubtask, setMinutesPerSubtask] = useState(prefill?.minutesPerSubtask?.toString() ?? '')
  const [totalSubtasks, setTotalSubtasks] = useState(prefill?.totalSubtasks?.toString() ?? '')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [unit, setUnit] = useState<UnitType>('minutes')
  const [customUnitLabel, setCustomUnitLabel] = useState('')
  const [day, setDay] = useState(defaultDate)
  const [error, setError] = useState<string | null>(prefill ? "Couldn't parse that — fill in manually" : null)
  const [suggested, setSuggested] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const t = useT()
  const { settings } = useSettings()

  useEffect(() => {
    if (prefill) titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount for this prefill instance
  }, [])

  const capacityOn = isCapacityEnabled(settings.capacityMode, settings.capacityMinutes)
  const capacityScopeTasks =
    useLiveQuery(async () => {
      if (!capacityOn) return []
      if (settings.capacityMode === 'daily') {
        const d = await db.days.where('date').equals(day).first()
        return d ? db.tasks.where('dayId').equals(d.id).toArray() : []
      }
      const start = weekStart(day)
      const end = addDays(start, 6)
      const weekDays = await db.days.where('date').between(start, end, true, true).toArray()
      const dayIds = weekDays.map((wd) => wd.id)
      return dayIds.length ? db.tasks.where('dayId').anyOf(dayIds).toArray() : []
      // eslint-disable-next-line react-hooks/exhaustive-deps -- capacityOn/settings.capacityMode gate what's fetched
    }, [day, capacityOn, settings.capacityMode]) ?? []

  const addingMinutes = capacityOn && unit === 'minutes' ? Number(minutesPerSubtask) * Number(totalSubtasks) : 0
  const capacityCheck =
    capacityOn && addingMinutes > 0 ? checkCapacity(capacityScopeTasks, addingMinutes, settings.capacityMinutes) : null

  async function handleMinutesFocus() {
    if (minutesPerSubtask.trim() || !title.trim()) return
    const matches = await db.tasks.where('title').equals(title.trim()).sortBy('createdAt')
    const recent = matches.slice(-5)
    if (recent.length === 0) return
    const avg = recent.reduce((s, t) => s + t.minutesPerSubtask, 0) / recent.length
    setMinutesPerSubtask(String(Math.round(avg * 10) / 10))
    setSuggested(true)
  }

  function readValidatedFields(): { minutes: number; total: number } | null {
    const minutes = Number(minutesPerSubtask)
    const total = Number(totalSubtasks)
    if (!title.trim()) {
      setError('Title is required.')
      return null
    }
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(total) || total <= 0) {
      setError(`Amount per subtask and total subtasks must be greater than 0.`)
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

    const targetDay = await getOrCreateDay(day)
    const now = Date.now()
    await db.tasks.add({
      id: uuid(),
      title: title.trim(),
      dayId: targetDay.id,
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
    setDay(defaultDate)
  }

  async function handleSaveAsTemplate() {
    const fields = readValidatedFields()
    if (!fields) return

    await db.templates.add({
      id: uuid(),
      title: title.trim(),
      minutesPerSubtask: fields.minutes,
      totalSubtasks: Math.floor(fields.total),
      recurrenceWeekdays: [],
      unit,
      customUnitLabel: unit === 'custom' ? customUnitLabel.trim() : undefined,
      createdAt: Date.now(),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-1.5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-1.5">
        <input
          ref={titleInputRef}
          type="text"
          placeholder={t('Task title (e.g. Solve DSA questions)')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs sm:col-span-1"
        />
        <input
          type="number"
          placeholder="Min/subtask"
          value={minutesPerSubtask}
          onChange={(e) => {
            setMinutesPerSubtask(e.target.value)
            setSuggested(false)
          }}
          onFocus={handleMinutesFocus}
          min={1}
          step="any"
          title={suggested ? 'Pre-filled from your last 5 instances of this title — editable' : undefined}
          className={`px-2.5 py-1.5 rounded-md border bg-white dark:bg-slate-700 text-xs w-28 ${
            suggested ? 'border-indigo-300 dark:border-indigo-600' : 'border-slate-200 dark:border-slate-600'
          }`}
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
              {t(p)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
        />
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
            {minutesPerSubtask} {unitLabel({ unit, customUnitLabel })} &times; {totalSubtasks} = {Number(minutesPerSubtask) * Number(totalSubtasks)}{' '}
            {unitLabel({ unit, customUnitLabel })}
          </span>
        )}
      </div>
      {capacityCheck?.overBudget && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400" role="status">
          ⚠ This would put {settings.capacityMode === 'daily' ? 'today' : 'this week'} at {capacityCheck.totalAfter}/{capacityCheck.budget} min (
          {capacityPercent(capacityCheck.totalAfter, capacityCheck.budget)}%) of your capacity.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
        >
          {t('Add Task')}
        </button>
        <button
          type="button"
          onClick={handleSaveAsTemplate}
          className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {t('Save as Template')}
        </button>
        {onToggleTemplates && (
          <button
            type="button"
            onClick={onToggleTemplates}
            aria-label="Toggle templates panel"
            className="px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            📋 {t('Templates')}
          </button>
        )}
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  )
}
