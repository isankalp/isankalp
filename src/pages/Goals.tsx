import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { minutesDone as taskMinutesDone, totalMinutes as taskTotalMinutes, type Goal } from '../db/models'

function GoalCard({ goal, allTaskTitles }: { goal: Goal; allTaskTitles: string[] }) {
  const tasks = useLiveQuery(
    () => db.tasks.where('title').anyOf(goal.linkedTaskTitles.length ? goal.linkedTaskTitles : ['__none__']).toArray(),
    [goal.linkedTaskTitles.join('|')],
  ) ?? []

  const planned = tasks.reduce((sum, t) => sum + taskTotalMinutes(t), 0)
  const done = tasks.reduce((sum, t) => sum + taskMinutesDone(t), 0)
  const percent = planned > 0 ? Math.round((done / planned) * 100) : 0
  const unmatched = goal.linkedTaskTitles.filter((t) => !allTaskTitles.includes(t))

  async function remove() {
    await db.goals.delete(goal.id)
  }

  return (
    <li className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{goal.title}</p>
          {goal.targetDate && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Target: {goal.targetDate}</p>
          )}
        </div>
        <button
          type="button"
          onClick={remove}
          className="text-slate-400 hover:text-red-600 text-sm shrink-0"
          aria-label={`Delete goal ${goal.title}`}
        >
          ✕
        </button>
      </div>

      {goal.linkedTaskTitles.length > 0 ? (
        <>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums w-12 text-right">{percent}%</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {done} / {planned} min across {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {goal.linkedTaskTitles.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                {t}
              </span>
            ))}
          </div>
          {unmatched.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              No tasks logged yet for: {unmatched.join(', ')}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          No linked task titles yet — link daily tasks by title to track progress toward this goal.
        </p>
      )}
    </li>
  )
}

export default function Goals() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const allTaskTitles = [...new Set(allTasks.map((t) => t.title))].sort()

  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedTitles, setSelectedTitles] = useState<string[]>([])

  function toggleTitle(t: string) {
    setSelectedTitles((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const goal: Goal = {
      id: uuid(),
      title: title.trim(),
      linkedTaskTitles: selectedTitles,
      targetDate: targetDate || undefined,
    }
    await db.goals.add(goal)
    setTitle('')
    setTargetDate('')
    setSelectedTitles([])
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Goals</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Goal title (e.g. Finish DSA prep)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap"
          >
            Add Goal
          </button>
        </div>

        {allTaskTitles.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              Link task titles to roll up progress (optional):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allTaskTitles.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTitle(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedTitles.includes(t)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {goals.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-slate-400 py-10">
          No goals yet. Add one above to start rolling up progress across days.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} allTaskTitles={allTaskTitles} />
          ))}
        </ul>
      )}
    </div>
  )
}
