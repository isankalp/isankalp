import { useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'

export default function AddTaskForm({ defaultDate }: { defaultDate: string }) {
  const [title, setTitle] = useState('')
  const [minutesPerSubtask, setMinutesPerSubtask] = useState('')
  const [totalSubtasks, setTotalSubtasks] = useState('')
  const [day, setDay] = useState(defaultDate)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const minutes = Number(minutesPerSubtask)
    const total = Number(totalSubtasks)
    if (!title.trim() || !Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(total) || total <= 0) {
      return
    }

    const targetDay = await getOrCreateDay(day)
    const now = Date.now()
    await db.tasks.add({
      id: uuid(),
      title: title.trim(),
      dayId: targetDay.id,
      minutesPerSubtask: minutes,
      totalSubtasks: Math.floor(total),
      completedSubtasks: 0,
      createdAt: now,
      updatedAt: now,
    })

    setTitle('')
    setMinutesPerSubtask('')
    setTotalSubtasks('')
    setDay(defaultDate)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
    >
      <input
        type="text"
        placeholder="Task title (e.g. Solve DSA questions)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={120}
        className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs sm:col-span-1"
      />
      <input
        type="number"
        placeholder="Min/subtask"
        value={minutesPerSubtask}
        onChange={(e) => setMinutesPerSubtask(e.target.value)}
        required
        min={1}
        step="any"
        className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-28"
      />
      <input
        type="number"
        placeholder="Total subtasks"
        value={totalSubtasks}
        onChange={(e) => setTotalSubtasks(e.target.value)}
        required
        min={1}
        step={1}
        className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-32"
      />
      <input
        type="date"
        value={day}
        onChange={(e) => setDay(e.target.value)}
        required
        className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
      />
      <button
        type="submit"
        className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
      >
        Add Task
      </button>
    </form>
  )
}
