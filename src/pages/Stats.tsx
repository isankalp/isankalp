import { useLiveQuery } from '../hooks/useLiveQuery'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db/db'
import { bucketTotals, breakdownByTitle, dailyTotals, fillMissingDays, trailingWindow, type Period } from '../lib/aggregate'
import { completedDateKeys, currentStreak, longestStreak } from '../lib/streaks'
import { addDays, todayKey } from '../lib/date'
import { useSettings } from '../context/SettingsContext'
import { unitOf } from '../db/models'

const periods: { value: Period; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const chartColors = {
  light: { planned: '#c7d2fe', done: '#4f46e5', grid: '#e2e8f0', tick: '#64748b' },
  dark: { planned: '#4338ca', done: '#818cf8', grid: '#334155', tick: '#94a3b8' },
}

export default function Stats() {
  const [period, setPeriod] = useState<Period>('day')
  const { settings } = useSettings()
  const colors = chartColors[settings.theme]
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  // CU-4: these charts sum minutes across tasks, so only minutes-unit tasks are included — other
  // units (pages, dollars, custom, ...) never get silently summed into a "minutes" number.
  const tasks = allTasks.filter((t) => unitOf(t) === 'minutes')
  const hasOtherUnits = allTasks.length > tasks.length

  const totals = dailyTotals(days, tasks)
  const windowed =
    period === 'day'
      ? fillMissingDays(trailingWindow(totals, 14, 'days'), addDays(todayKey(), -13), todayKey())
      : trailingWindow(totals, period === 'week' ? 56 : 180, period === 'week' ? 'weeks' : 'months')
  const chartData = bucketTotals(windowed, period)

  const completedDates = completedDateKeys(days, tasks)
  const streak = currentStreak(completedDates)
  const best = longestStreak(completedDates)

  const breakdown = breakdownByTitle(tasks, days, addDays(todayKey(), -6)).slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Stats & Streaks</h2>
        <div className="flex items-center gap-3">
          <Link to="/heatmap" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            Heatmap →
          </Link>
          <Link to="/insights" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            Insights →
          </Link>
        </div>
      </div>

      {hasOtherUnits && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-2">
          These charts cover minutes-based tasks only — tasks in other units aren't summed in here.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{streak}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Current streak (days)</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
          <p className="text-2xl font-bold">{best}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Longest streak (days)</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Minutes planned vs. done</h3>
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-700">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  period === p.value
                    ? 'bg-white dark:bg-slate-900 shadow text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="label" fontSize={11} stroke={colors.tick} />
              <YAxis fontSize={11} stroke={colors.tick} />
              <Tooltip
                contentStyle={{
                  backgroundColor: settings.theme === 'dark' ? '#1e293b' : '#ffffff',
                  borderColor: colors.grid,
                  fontSize: 12,
                  borderRadius: 8,
                }}
                labelStyle={{ color: settings.theme === 'dark' ? '#e2e8f0' : '#0f172a' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="planned" name="Planned" fill={colors.planned} radius={[4, 4, 0, 0]} />
              <Bar dataKey="done" name="Done" fill={colors.done} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h3 className="font-semibold text-sm mb-2">Breakdown by task (last 7 days)</h3>
        {breakdown.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No completed work in the last 7 days yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {breakdown.map((b) => (
              <li key={b.title} className="flex items-center justify-between text-xs">
                <span>{b.title}</span>
                <span className="font-medium tabular-nums">{b.minutes} min</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
