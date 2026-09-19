import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartErrorBoundary from '../components/ChartErrorBoundary'
import { db } from '../db/db'
import { useSettings } from '../context/SettingsContext'
import {
  MIN_HISTORY_WEEKS,
  MIN_RATED_TASKS,
  effortVarianceRows,
  energyCorrelation,
  generateObservations,
  timeOfDayBuckets,
  weekdayCompletionStats,
  weeksOfHistory,
} from '../lib/insights'

const chartColors = {
  light: { bar: '#4f46e5', grid: '#e2e8f0', tick: '#64748b' },
  dark: { bar: '#818cf8', grid: '#334155', tick: '#94a3b8' },
}

function EmptySection({ text }: { text: string }) {
  return <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">{text}</p>
}

function Skeleton() {
  return <div className="h-40 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
}

export default function Insights() {
  const { settings } = useSettings()
  const colors = chartColors[settings.theme]

  const days = useLiveQuery(() => db.days.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const events = useLiveQuery(() => db.completionEvents.toArray(), [])

  const loading = days === undefined || tasks === undefined || events === undefined

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Insights</h2>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    )
  }

  const hasEnoughHistory = weeksOfHistory(days) >= MIN_HISTORY_WEEKS

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Insights</h2>
        <Link to="/stats" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to Stats
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h3 className="font-semibold text-sm mb-2">Patterns</h3>
        <ChartErrorBoundary label="pattern insights">
          {!hasEnoughHistory ? (
            <EmptySection text="Not enough data yet — check back after a few more weeks." />
          ) : (
            (() => {
              const observations = generateObservations(weekdayCompletionStats(days, tasks))
              return observations.length === 0 ? (
                <EmptySection text="No strong patterns detected yet." />
              ) : (
                <ul className="space-y-1.5">
                  {observations.map((o) => (
                    <li key={o} className="text-xs px-2.5 py-2 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                      {o}
                    </li>
                  ))}
                </ul>
              )
            })()
          )}
        </ChartErrorBoundary>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h3 className="font-semibold text-sm mb-2">Time of day</h3>
        <ChartErrorBoundary label="time-of-day chart">
          {!hasEnoughHistory ? (
            <EmptySection text="Not enough data yet — check back after a few more weeks." />
          ) : (
            (() => {
              const buckets = timeOfDayBuckets(events).map((b) => ({ ...b, label: `${b.hour}:00` }))
              const hasActivity = buckets.some((b) => b.count > 0)
              return !hasActivity ? (
                <EmptySection text="Not enough data yet — check back after a few more weeks." />
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="label" fontSize={10} stroke={colors.tick} interval={2} />
                      <YAxis fontSize={11} stroke={colors.tick} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: settings.theme === 'dark' ? '#1e293b' : '#ffffff',
                          borderColor: colors.grid,
                          fontSize: 12,
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: settings.theme === 'dark' ? '#e2e8f0' : '#0f172a' }}
                      />
                      <Bar dataKey="count" name="Subtasks completed" fill={colors.bar} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })()
          )}
        </ChartErrorBoundary>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h3 className="font-semibold text-sm mb-2">Planned vs. actual effort (Focus Timer)</h3>
        <ChartErrorBoundary label="effort variance table">
          {(() => {
            const rows = effortVarianceRows(tasks)
            return rows.length === 0 ? (
              <EmptySection text="Not enough data yet — use Focus Timer on a few tasks first." />
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="font-medium pb-1">Task</th>
                    <th className="font-medium pb-1 text-right">Planned</th>
                    <th className="font-medium pb-1 text-right">Actual</th>
                    <th className="font-medium pb-1 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.title} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-1 truncate max-w-[10rem]">{r.title}</td>
                      <td className="py-1 text-right tabular-nums">{r.plannedMinutes}m</td>
                      <td className="py-1 text-right tabular-nums">{r.actualMinutes}m</td>
                      <td
                        className={`py-1 text-right tabular-nums font-medium ${
                          r.variancePercent > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {r.variancePercent > 0 ? '+' : ''}
                        {r.variancePercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
        </ChartErrorBoundary>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h3 className="font-semibold text-sm mb-2">Energy vs. completion</h3>
        <ChartErrorBoundary label="mood correlation chart">
          {(() => {
            const rows = energyCorrelation(tasks)
            return rows.length === 0 ? (
              <EmptySection text={`Not enough data yet — log an energy rating on at least ${MIN_RATED_TASKS} tasks first.`} />
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.map((r) => ({ ...r, label: `${r.rating}★` }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="label" fontSize={11} stroke={colors.tick} />
                    <YAxis fontSize={11} stroke={colors.tick} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: settings.theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: colors.grid,
                        fontSize: 12,
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: settings.theme === 'dark' ? '#e2e8f0' : '#0f172a' }}
                    />
                    <Bar dataKey="avgPercent" name="Avg. completion" fill={colors.bar} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </ChartErrorBoundary>
      </div>
    </div>
  )
}
