import { useEffect, useRef, useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { PRIORITIES, type Priority } from '../db/models'

export interface AddTaskPrefill {
  title: string
  minutesPerSubtask?: number
  totalSubtasks?: number
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
  const [day, setDay] = useState(defaultDate)
  const [error, setError] = useState<string | null>(prefill ? "Couldn't parse that — fill in manually" : null)
  const [suggested, setSuggested] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (prefill) titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount for this prefill instance
  }, [])

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
      setError('Minutes per subtask and total subtasks must be greater than 0.')
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
          placeholder="Task title (e.g. Solve DSA questions)"
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
              {p}
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
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
        >
          Add Task
        </button>
        <button
          type="button"
          onClick={handleSaveAsTemplate}
          className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Save as Template
        </button>
        {onToggleTemplates && (
          <button
            type="button"
            onClick={onToggleTemplates}
            aria-label="Toggle templates panel"
            className="px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            📋 Templates
          </button>
        )}
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  )
}
