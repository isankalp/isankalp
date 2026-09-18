import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db/db'
import { bucketTotals, breakdownByTitle, dailyTotals, fillMissingDays, trailingWindow, type Period } from '../lib/aggregate'
import { completedDateKeys, currentStreak, longestStreak } from '../lib/streaks'
import { addDays, todayKey } from '../lib/date'

const periods: { value: Period; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

export default function Stats() {
  const [period, setPeriod] = useState<Period>('day')
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []

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
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Stats & Streaks</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{streak}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Current streak (days)</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-3xl font-bold">{best}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Longest streak (days)</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Minutes planned vs. done</h3>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  period === p.value
                    ? 'bg-white dark:bg-slate-950 shadow text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" name="Planned" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
              <Bar dataKey="done" name="Done" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-semibold mb-3">Breakdown by task (last 7 days)</h3>
        {breakdown.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No completed work in the last 7 days yet.</p>
        ) : (
          <ul className="space-y-2">
            {breakdown.map((b) => (
              <li key={b.title} className="flex items-center justify-between text-sm">
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
