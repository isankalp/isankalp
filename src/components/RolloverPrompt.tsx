import { useEffect, useState } from 'react'
import { acceptRollover, declineRollover, getRolloverCandidates, type RolloverCandidate } from '../lib/rollover'

export default function RolloverPrompt({ date }: { date: string }) {
  const [candidates, setCandidates] = useState<RolloverCandidate[]>([])

  useEffect(() => {
    let cancelled = false
    getRolloverCandidates(date).then((c) => {
      if (!cancelled) setCandidates(c)
    })
    return () => {
      cancelled = true
    }
  }, [date])

  if (candidates.length === 0) return null
  const current = candidates[0]

  async function handleAccept() {
    await acceptRollover(current, date)
    setCandidates((prev) => prev.slice(1))
  }

  function handleDecline() {
    declineRollover(current)
    setCandidates((prev) => prev.slice(1))
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10 text-xs flex items-center justify-between gap-3 flex-wrap">
      <span>
        Roll over <strong>{current.remaining}</strong> remaining subtask{current.remaining === 1 ? '' : 's'} of &ldquo;
        {current.task.title}&rdquo; to today?
      </span>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={handleAccept}
          className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          No
        </button>
      </div>
    </div>
  )
}
