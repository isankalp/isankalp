import { useEffect, useState } from 'react'
import { useAiClient } from '../hooks/useAiClient'
import { isGrounded } from '../lib/grounding'
import type { DayTotal } from '../lib/aggregate'

/** Epic 54 AI-1/AI-2/AI-5: a narrative recap grounded strictly in this period's own stats. Every
 *  number the AI states is checked against the data it was given (see lib/grounding.ts); if it fails
 *  that check, or the request fails, we show a plain honest fallback rather than risk a fabricated
 *  figure ever reaching the screen. */
export default function WeeklyRecap({
  planned,
  done,
  tasksCompleted,
  streak,
  longestStreak,
  dayTotals,
}: {
  planned: number
  done: number
  tasksCompleted: number
  streak: number
  longestStreak: number
  dayTotals: DayTotal[]
}) {
  const { configured, text } = useAiClient()
  const [recap, setRecap] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'not-enough'>('idle')

  const hasEnoughHistory = dayTotals.length >= 2 && done > 0

  useEffect(() => {
    if (!configured) return
    if (!hasEnoughHistory) {
      setStatus('not-enough')
      return
    }
    let cancelled = false
    setStatus('loading')
    const allowedNumbers = [
      planned,
      done,
      tasksCompleted,
      streak,
      longestStreak,
      ...dayTotals.flatMap((d) => [d.planned, d.done]),
    ]
    const dataSummary = dayTotals.map((d) => `${d.date}: ${d.done}/${d.planned} min done`).join('\n')
    text({
      system:
        'Write a short (2-3 sentence), grounded weekly recap using ONLY the exact numbers given below. Never estimate, round differently, or invent any figure not listed. If you reference a count or minutes value, it must match one of these exactly.',
      messages: [
        {
          role: 'user',
          content: `Week totals: ${done}/${planned} minutes done, ${tasksCompleted} tasks completed, current streak ${streak} days, longest streak ${longestStreak} days.\nPer-day breakdown:\n${dataSummary}`,
        },
      ],
      maxTokens: 200,
    }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setStatus('error')
        return
      }
      if (!isGrounded(result.data, allowedNumbers)) {
        setStatus('error')
        return
      }
      setRecap(result.data)
      setStatus('idle')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the period's own data identity changes
  }, [configured, planned, done, tasksCompleted, streak, longestStreak])

  if (!configured) return null

  return (
    <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10">
      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">✨ AI Recap</p>
      {status === 'loading' && <div className="h-4 w-3/4 rounded bg-indigo-100 dark:bg-indigo-500/20 animate-pulse" />}
      {status === 'not-enough' && <p className="text-xs text-slate-500 dark:text-slate-400">Not enough history yet</p>}
      {status === 'error' && <p className="text-xs text-slate-500 dark:text-slate-400">Recap unavailable right now — your stats above are still accurate.</p>}
      {recap && status === 'idle' && <p className="text-xs text-slate-700 dark:text-slate-300">{recap}</p>}
    </div>
  )
}
