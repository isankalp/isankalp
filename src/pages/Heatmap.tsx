import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import clsx from 'clsx'
import { db } from '../db/db'
import {
  availableCategories,
  availableUnits,
  computeHeatmapDays,
  hasAnyHistory,
  type HeatmapDay,
} from '../lib/heatmap'
import { parseDateKey, todayKey } from '../lib/date'

const WEEKDAY_LABELS = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat']

const SHADE_CLASSES = [
  'bg-slate-100 dark:bg-slate-800',
  'bg-indigo-100 dark:bg-indigo-900',
  'bg-indigo-200 dark:bg-indigo-700',
  'bg-indigo-400 dark:bg-indigo-600',
  'bg-emerald-500',
]

function shadeClass(percent: number): string {
  if (percent <= 0) return SHADE_CLASSES[0]
  if (percent < 25) return SHADE_CLASSES[1]
  if (percent < 50) return SHADE_CLASSES[2]
  if (percent < 75) return SHADE_CLASSES[3]
  return SHADE_CLASSES[4]
}

/** Groups a contiguous run of day cells into Sunday-first weeks (columns), padding both ends with nulls. */
function buildWeeks(cells: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (cells.length === 0) return []
  const firstDow = parseDateKey(cells[0].date).getDay()
  const padded: (HeatmapDay | null)[] = [...Array(firstDow).fill(null), ...cells]
  while (padded.length % 7 !== 0) padded.push(null)
  const weeks: (HeatmapDay | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))
  return weeks
}

export default function Heatmap() {
  const days = useLiveQuery(() => db.days.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const [unitFilter, setUnitFilter] = useState('minutes')
  const [categoryFilter, setCategoryFilter] = useState('')

  const loading = days === undefined || tasks === undefined

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-3">Contribution Heatmap</h2>
        <div className="grid grid-cols-[repeat(53,1fr)] gap-0.5 animate-pulse">
          {Array.from({ length: 53 * 7 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-sm bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  const units = availableUnits(tasks)
  const categories = availableCategories(tasks)
  const heatmapDays = computeHeatmapDays(days, tasks, {
    unitKey: unitFilter || undefined,
    category: categoryFilter || undefined,
  })
  const weeks = buildWeeks(heatmapDays)
  const totalDone = heatmapDays.reduce((s, d) => s + (d.percent >= 100 ? 1 : 0), 0)
  const empty = !hasAnyHistory(heatmapDays)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold">Contribution Heatmap</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">{totalDone} full days in the last year</span>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
        Private to you — this view isn't shared or published anywhere.
      </p>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          aria-label="Filter heatmap by unit"
          className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
        >
          {units.length === 0 && <option value="minutes">Minutes</option>}
          {units.map((u) => (
            <option key={u.key} value={u.key}>
              {u.label}
            </option>
          ))}
        </select>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter heatmap by tag"
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
          >
            <option value="">All tags</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {empty ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">
          No history yet — your heatmap fills in as you go.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-2 w-max">
            <div className="flex flex-col gap-0.5 text-[9px] text-slate-400 dark:text-slate-500 pt-0.5">
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={i} className="h-3 flex items-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="flex gap-0.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((cell, di) =>
                    cell ? (
                      <div
                        key={di}
                        title={`${cell.date}: ${cell.done} / ${cell.planned} (${cell.percent}%)`}
                        className={clsx('w-3 h-3 rounded-sm', shadeClass(cell.percent), cell.date === todayKey() && 'ring-1 ring-indigo-600')}
                      />
                    ) : (
                      <div key={di} className="w-3 h-3" />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span>Less</span>
        {SHADE_CLASSES.map((c) => (
          <span key={c} className={clsx('w-3 h-3 rounded-sm', c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
