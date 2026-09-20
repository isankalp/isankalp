import { useLiveQuery } from '../hooks/useLiveQuery'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { db } from '../db/db'
import { dailyCompletionSummaries } from '../lib/aggregate'
import { addMonths, monthGrid, parseDateKey, todayKey } from '../lib/date'

const STATE_CLASS: Record<'complete' | 'incomplete' | 'none', string> = {
  complete: 'bg-emerald-500 text-white',
  incomplete: 'bg-red-800 text-white',
  none: 'bg-slate-100 dark:bg-slate-800',
}

// Epic 72: binary complete/incomplete color, never a percent gradient — a day is fully green only
// once every task on it is done, and fully (dark) red the instant even one isn't, regardless of
// how close to 100% the day's aggregate percent (Epic 73) actually is.
export default function Calendar() {
  const navigate = useNavigate()
  const [monthAnchor, setMonthAnchor] = useState(todayKey())
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []

  const summaryByDate = new Map(dailyCompletionSummaries(days, tasks).map((s) => [s.date, s]))
  const grid = monthGrid(monthAnchor)
  const currentMonth = parseDateKey(monthAnchor).getMonth()
  const monthLabel = parseDateKey(monthAnchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}
          className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
        >
          ← Prev
        </button>
        <h2 className="text-base font-bold">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
          className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 dark:text-slate-400 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((date) => {
          const inMonth = parseDateKey(date).getMonth() === currentMonth
          const summary = summaryByDate.get(date)
          const state = summary?.state ?? 'none'
          const title = summary && summary.percent !== null ? `${date}: ${summary.percent}% of subtasks done` : date
          return (
            <button
              key={date}
              type="button"
              onClick={() => navigate(`/day/${date}`)}
              title={title}
              className={clsx(
                'aspect-square rounded-md text-xs flex flex-col items-center justify-center gap-0.5 transition-colors',
                inMonth ? STATE_CLASS[state] : 'bg-transparent text-slate-300 dark:text-slate-700',
                date === todayKey() && 'ring-2 ring-indigo-600',
              )}
            >
              <span className="font-medium">{parseDateKey(date).getDate()}</span>
              {summary && summary.percent !== null && <span className="text-[10px] opacity-80">{summary.percent}%</span>}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="w-3.5 h-3.5 rounded bg-emerald-500" /> All tasks done
        <span className="w-3.5 h-3.5 rounded bg-red-800 ml-2" /> Something incomplete
        <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800 ml-2" /> No tasks
      </div>
    </div>
  )
}
