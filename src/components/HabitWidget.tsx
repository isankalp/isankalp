import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { currentStreak, longestStreak } from '../lib/streaks'

export default function HabitWidget({ date }: { date: string }) {
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? []
  const logs = useLiveQuery(() => db.habitLogs.toArray(), []) ?? []
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const activeHabits = habits.filter((h) => !h.archivedAt)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Habit title is required.')
      return
    }
    setError(null)
    await db.habits.add({ id: uuid(), title: title.trim(), createdAt: Date.now() })
    setTitle('')
    setAdding(false)
  }

  async function toggleHabit(habitId: string) {
    const existing = logs.find((l) => l.habitId === habitId && l.date === date)
    if (existing) {
      await db.habitLogs.delete(existing.id)
    } else {
      await db.habitLogs.add({ id: uuid(), habitId, date, completedAt: Date.now() })
    }
  }

  async function deleteHabit(habitId: string) {
    await db.habits.update(habitId, { archivedAt: Date.now() })
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Habits</h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          + Add Habit
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex items-center gap-1.5 mb-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Habit title"
            maxLength={80}
            autoFocus
            className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <button type="submit" className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
            Save
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}

      {activeHabits.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No habits yet — add your first one.</p>
      ) : (
        <ul className="space-y-1.5">
          {activeHabits.map((habit) => {
            const habitDates = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.date))
            const checked = habitDates.has(date)
            const streak = currentStreak(habitDates)
            const best = longestStreak(habitDates)
            return (
              <li key={habit.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleHabit(habit.id)}
                  aria-label={`Mark ${habit.title} complete for ${date}`}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className={checked ? 'flex-1 line-through text-slate-500 dark:text-slate-400' : 'flex-1'}>{habit.title}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  🔥 {streak} <span className="text-slate-300 dark:text-slate-600">best {best}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteHabit(habit.id)}
                  aria-label={`Delete ${habit.title}`}
                  className="text-slate-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
