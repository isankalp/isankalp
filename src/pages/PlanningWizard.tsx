import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { db, getOrCreateDay } from '../db/db'
import { buildWeeklySuggestions, type PlanSuggestion } from '../lib/planningWizard'
import { todayKey } from '../lib/date'

interface DraftSuggestion extends PlanSuggestion {
  included: boolean
}

export default function PlanningWizard() {
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [drafts, setDrafts] = useState<DraftSuggestion[]>([])

  useEffect(() => {
    let cancelled = false
    buildWeeklySuggestions()
      .then((suggestions) => {
        if (cancelled) return
        setDrafts(suggestions.map((s) => ({ ...s, included: true })))
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateDraft(id: string, patch: Partial<DraftSuggestion>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  async function confirm(onlySelected: boolean) {
    const targetDate = todayKey()
    const day = await getOrCreateDay(targetDate)
    const now = Date.now()
    const toAdd = drafts.filter((d) => (onlySelected ? d.included : true))
    for (const d of toAdd) {
      await db.tasks.add({
        id: uuid(),
        title: d.taskTitle,
        dayId: day.id,
        minutesPerSubtask: d.minutesPerSubtask,
        totalSubtasks: d.totalSubtasks,
        completedSubtasks: 0,
        priority: 'Medium',
        createdAt: now,
        updatedAt: now,
      })
    }
    navigate(`/day/${targetDate}`)
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">Plan Your Week</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Suggested from your goal-linked tasks and their average pace over the last 4 weeks. Edit or remove any
        suggestion before confirming — nothing is added until you say so.
      </p>

      {state === 'loading' && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10 text-sm">
          Couldn't generate suggestions.{' '}
          <button type="button" onClick={() => navigate(`/day/${todayKey()}`)} className="underline font-medium">
            Add tasks manually instead
          </button>
          .
        </div>
      )}

      {state === 'ready' && drafts.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
          No unfinished goals to suggest from — add tasks manually.
        </p>
      )}

      {state === 'ready' && drafts.length > 0 && (
        <>
          <ul className="space-y-2 mb-4">
            {drafts.map((d) => (
              <li
                key={d.id}
                className={`p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${!d.included ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={d.included}
                    onChange={(e) => updateDraft(d.id, { included: e.target.checked })}
                    aria-label={`Include ${d.taskTitle}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{d.taskTitle}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">from goal: {d.goalTitle}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="number"
                          value={d.minutesPerSubtask}
                          min={0.1}
                          step="any"
                          onChange={(e) => updateDraft(d.id, { minutesPerSubtask: Number(e.target.value) || d.minutesPerSubtask })}
                          aria-label={`Minutes per subtask for ${d.taskTitle}`}
                          className="w-14 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-right tabular-nums"
                        />
                        min/subtask
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="number"
                          value={d.totalSubtasks}
                          min={1}
                          step={1}
                          onChange={(e) => updateDraft(d.id, { totalSubtasks: Math.max(1, Math.floor(Number(e.target.value)) || d.totalSubtasks) })}
                          aria-label={`Total subtasks for ${d.taskTitle}`}
                          className="w-14 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-right tabular-nums"
                        />
                        subtasks
                      </label>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => confirm(false)}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={() => confirm(true)}
              disabled={!drafts.some((d) => d.included)}
              className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              Accept Selected
            </button>
          </div>
        </>
      )}
    </div>
  )
}
