import { useNavigate } from 'react-router-dom'
import { addDays, formatDisplayDate, isToday, todayKey } from '../lib/date'

export default function DayNav({ date }: { date: string }) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
      <button
        type="button"
        onClick={() => navigate(`/day/${addDays(date, -1)}`)}
        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
        aria-label="Previous day"
      >
        ← Prev
      </button>

      <div className="flex items-center gap-1.5 text-center flex-wrap justify-center">
        <span className="font-semibold text-sm">{formatDisplayDate(date)}</span>
        {isToday(date) ? (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            Today
          </span>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/day/${todayKey()}`)}
            className="text-[11px] px-1.5 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Jump to today
          </button>
        )}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && navigate(`/day/${e.target.value}`)}
          className="text-xs border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 bg-white dark:bg-slate-800"
          aria-label="Jump to date"
        />
      </div>

      <button
        type="button"
        onClick={() => navigate(`/day/${addDays(date, 1)}`)}
        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
        aria-label="Next day"
      >
        Next →
      </button>
    </div>
  )
}
