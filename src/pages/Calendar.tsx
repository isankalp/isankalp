import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { db } from '../db/db'
import { dailyTotals } from '../lib/aggregate'
import { addMonths, monthGrid, parseDateKey, todayKey } from '../lib/date'

function shade(percent: number): string {
  if (percent <= 0) return 'bg-slate-100 dark:bg-slate-800'
  if (percent < 25) return 'bg-indigo-100 dark:bg-indigo-900/40'
  if (percent < 50) return 'bg-indigo-200 dark:bg-indigo-800/60'
  if (percent < 75) return 'bg-indigo-400 dark:bg-indigo-600 text-white'
  if (percent < 100) return 'bg-indigo-500 dark:bg-indigo-500 text-white'
  return 'bg-emerald-500 text-white'
}

export default function Calendar() {
  const navigate = useNavigate()
  const [monthAnchor, setMonthAnchor] = useState(todayKey())
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []

  const totalsByDate = new Map(dailyTotals(days, tasks).map((t) => [t.date, t]))
  const grid = monthGrid(monthAnchor)
  const currentMonth = parseDateKey(monthAnchor).getMonth()
  const monthLabel = parseDateKey(monthAnchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function percentFor(date: string): number {
    const t = totalsByDate.get(date)
    if (!t || t.planned <= 0) return 0
    return Math.round((t.done / t.planned) * 100)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
        >
          ← Prev
        </button>
        <h2 className="text-lg font-bold">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((date) => {
          const inMonth = parseDateKey(date).getMonth() === currentMonth
          const percent = percentFor(date)
          const hasData = totalsByDate.has(date) && (totalsByDate.get(date)?.planned ?? 0) > 0
          return (
            <button
              key={date}
              type="button"
              onClick={() => navigate(`/day/${date}`)}
              className={clsx(
                'aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors',
                inMonth ? shade(percent) : 'bg-transparent text-slate-300 dark:text-slate-700',
                date === todayKey() && 'ring-2 ring-indigo-600',
              )}
            >
              <span className="font-medium">{parseDateKey(date).getDate()}</span>
              {hasData && <span className="text-[10px] opacity-80">{percent}%</span>}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 dark:text-slate-400">
        <span>Less</span>
        <span className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800" />
        <span className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/40" />
        <span className="w-4 h-4 rounded bg-indigo-200 dark:bg-indigo-800/60" />
        <span className="w-4 h-4 rounded bg-indigo-400 dark:bg-indigo-600" />
        <span className="w-4 h-4 rounded bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  )
}
