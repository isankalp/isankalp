import { useState } from 'react'
import clsx from 'clsx'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { addMonths, monthGrid, parseDateKey, todayKey } from '../lib/date'
import { lifestyleDayState } from '../lib/lifestyle'

const STATE_CLASS: Record<'pass' | 'fail' | 'none', string> = {
  pass: 'bg-emerald-500 text-white',
  fail: 'bg-red-700 text-white',
  none: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

// Epic 71: month view of daily lifestyle pass/fail state, separate from the Task Calendar (Epic 72).
export default function LifestyleCalendarView({
  onSelectDate,
  onEditTargets,
}: {
  onSelectDate: (date: string) => void
  onEditTargets: () => void
}) {
  const [monthAnchor, setMonthAnchor] = useState(todayKey())
  const fields = useLiveQuery(() => db.lifestyleFields.toArray(), []) ?? []
  const entries = useLiveQuery(() => db.lifestyleEntries.toArray(), []) ?? []

  const activeFieldIds = fields.filter((f) => !f.archivedAt).map((f) => f.id)
  const entriesByDate = new Map<string, typeof entries>()
  for (const e of entries) {
    const list = entriesByDate.get(e.date) ?? []
    list.push(e)
    entriesByDate.set(e.date, list)
  }

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
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
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
          const state = lifestyleDayState(entriesByDate.get(date) ?? [], activeFieldIds)
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={clsx(
                'aspect-square rounded-md text-xs flex items-center justify-center transition-colors',
                inMonth ? STATE_CLASS[state] : 'bg-transparent text-slate-300 dark:text-slate-700',
                date === todayKey() && 'ring-2 ring-indigo-600',
              )}
            >
              {parseDateKey(date).getDate()}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="w-3.5 h-3.5 rounded bg-emerald-500" /> All met
          <span className="w-3.5 h-3.5 rounded bg-red-700 ml-2" /> Missed one
          <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-700 ml-2" /> No entry
        </div>
        <button type="button" onClick={onEditTargets} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
          Edit Targets
        </button>
      </div>
    </div>
  )
}
