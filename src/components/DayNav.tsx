import { useNavigate } from 'react-router-dom'
import { addDays, formatDisplayDate, isToday, todayKey } from '../lib/date'

export default function DayNav({ date }: { date: string }) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <button
        type="button"
        onClick={() => navigate(`/day/${addDays(date, -1)}`)}
        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
        aria-label="Previous day"
      >
        ← Prev
      </button>

      <div className="flex items-center gap-2 text-center">
        <span className="font-semibold">{formatDisplayDate(date)}</span>
        {isToday(date) ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            Today
          </span>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/day/${todayKey()}`)}
            className="text-xs px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Jump to today
          </button>
        )}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && navigate(`/day/${e.target.value}`)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900"
          aria-label="Jump to date"
        />
      </div>

      <button
        type="button"
        onClick={() => navigate(`/day/${addDays(date, 1)}`)}
        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
        aria-label="Next day"
      >
        Next →
      </button>
    </div>
  )
}
