import { useEffect, useState } from 'react'
import { useAiClient } from '../hooks/useAiClient'
import { dayMinutesPlanned, isTaskComplete, type Day, type Task } from '../db/models'
import { addDays } from '../lib/date'
import { lastCompletedDate } from '../lib/streaks'

const DIAGNOSIS_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    observation: { type: 'string', description: 'A specific, factual observation about why the streak likely broke' },
    basedOnDates: { type: 'array', items: { type: 'string' }, description: 'The YYYY-MM-DD dates the observation is drawn from' },
  },
  required: ['observation', 'basedOnDates'],
}

/** Epic 54 AI-3/AI-4/AI-5: only renders once there's an actual break to explain, and always shows
 *  exactly which days the observation is based on (AI-4) rather than a bare claim. */
export default function StreakDiagnosis({ days, tasks, completedDates, currentStreak }: { days: Day[]; tasks: Task[]; completedDates: Set<string>; currentStreak: number }) {
  const { configured, structured } = useAiClient()
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'not-enough' | 'error'>('idle')
  const [result, setResult] = useState<{ observation: string; basedOnDates: string[] } | null>(null)

  const lastDone = lastCompletedDate(completedDates)

  useEffect(() => {
    if (!configured) return
    if (currentStreak > 0 || !lastDone || completedDates.size < 4) {
      setState('not-enough')
      return
    }
    const breakDate = addDays(lastDone, 1)
    let cancelled = false
    setState('loading')

    const dayByDate = new Map(days.map((d) => [d.date, d]))
    const tasksByDayId = new Map<string, Task[]>()
    for (const task of tasks) {
      const list = tasksByDayId.get(task.dayId) ?? []
      list.push(task)
      tasksByDayId.set(task.dayId, list)
    }
    const windowDates = [-3, -2, -1, 0, 1, 2].map((offset) => addDays(breakDate, offset))
    const summary = windowDates
      .map((date) => {
        const day = dayByDate.get(date)
        const dayTasks = day ? (tasksByDayId.get(day.id) ?? []) : []
        const plannedMinutes = dayMinutesPlanned(dayTasks)
        const completedCount = dayTasks.filter(isTaskComplete).length
        const weekday = new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
        return `${date} (${weekday}): ${plannedMinutes} min planned across ${dayTasks.length} task(s), ${completedCount} completed`
      })
      .join('\n')

    structured<{ observation: string; basedOnDates: string[] }>({
      system:
        'Given this window of days around where a completion streak broke, give one specific, factual observation about a likely contributing pattern (task load, weekday pattern). Only reference facts present in the data below — never invent a cause. List the exact dates your observation draws from.',
      messages: [{ role: 'user', content: `Streak broke after ${lastDone}.\n${summary}` }],
      toolName: 'diagnose_streak_break',
      toolDescription: 'Give one specific, data-grounded observation about why a streak likely broke.',
      inputSchema: DIAGNOSIS_TOOL_SCHEMA,
      maxTokens: 300,
    }).then((r) => {
      if (cancelled) return
      if (!r.ok) {
        setState('error')
        return
      }
      setResult(r.data)
      setState('ready')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the streak/history identity changes
  }, [configured, currentStreak, lastDone, completedDates.size])

  if (!configured || state === 'idle' || state === 'not-enough') return null

  return (
    <div className="mt-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10">
      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">✨ Why the streak broke</p>
      {state === 'loading' && <div className="h-4 w-3/4 rounded bg-indigo-100 dark:bg-indigo-500/20 animate-pulse" />}
      {state === 'error' && <p className="text-xs text-slate-500 dark:text-slate-400">Not enough history yet</p>}
      {state === 'ready' && result && (
        <>
          <p className="text-xs text-slate-700 dark:text-slate-300">{result.observation}</p>
          {result.basedOnDates.length > 0 && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Based on: {result.basedOnDates.join(', ')}</p>
          )}
        </>
      )}
    </div>
  )
}
