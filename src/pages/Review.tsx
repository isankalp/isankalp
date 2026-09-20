import { useLiveQuery } from '../hooks/useLiveQuery'
import { useState } from 'react'
import { db } from '../db/db'
import { dailyTotals } from '../lib/aggregate'
import { completedDateKeys, currentStreak, longestStreak } from '../lib/streaks'
import { currentPeriodKey, formatPeriodLabel, isPeriodInProgress, periodRange, reviewId } from '../lib/review'
import { exportReviewPdf } from '../lib/pdfExport'
import { isTaskComplete, type ReviewPeriodType } from '../db/models'
import { todayKey } from '../lib/date'

function ReviewDetail({ type, periodKey, onBack }: { type: ReviewPeriodType; periodKey: string; onBack: () => void }) {
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const review = useLiveQuery(() => db.reviews.get(reviewId(type, periodKey)), [type, periodKey])

  const { start, end } = periodRange(type, periodKey)
  const totals = dailyTotals(days, tasks).filter((t) => t.date >= start && t.date <= end)
  const planned = totals.reduce((sum, t) => sum + t.planned, 0)
  const done = totals.reduce((sum, t) => sum + t.done, 0)

  const dayIdsInRange = new Set(days.filter((d) => d.date >= start && d.date <= end).map((d) => d.id))
  const tasksCompleted = tasks.filter((t) => dayIdsInRange.has(t.dayId) && isTaskComplete(t)).length

  const completedDates = completedDateKeys(days, tasks)
  const streak = currentStreak(completedDates)
  const best = longestStreak(completedDates)

  const inProgress = isPeriodInProgress(type, periodKey)

  async function saveReflection(text: string) {
    await db.reviews.put({ id: reviewId(type, periodKey), periodType: type, periodKey, reflection: text, updatedAt: Date.now() })
  }

  function handleExportPdf() {
    exportReviewPdf({
      type,
      periodKey,
      minutesPlanned: planned,
      minutesDone: done,
      tasksCompleted,
      streak,
      longestStreak: best,
      reflection: review?.reflection ?? '',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ← History
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="text-[11px] px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Export PDF
          </button>
          {inProgress && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              In progress
            </span>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">{formatPeriodLabel(type, periodKey)}</h2>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-center">
          <p className="text-lg font-bold">
            {done}/{planned}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Minutes done/planned</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-center">
          <p className="text-lg font-bold">{tasksCompleted}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Tasks completed</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-center">
          <p className="text-lg font-bold">
            {streak} <span className="text-xs font-normal text-slate-400">/ {best} best</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Streak</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Reflection</label>
        <textarea
          key={reviewId(type, periodKey)}
          defaultValue={review?.reflection ?? ''}
          onBlur={(e) => saveReflection(e.target.value)}
          placeholder="How did this period go?"
          rows={4}
          maxLength={4000}
          className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-y"
        />
      </div>
    </div>
  )
}

function HistoryList({ onSelect }: { onSelect: (type: ReviewPeriodType, periodKey: string) => void }) {
  const reviews = useLiveQuery(() => db.reviews.orderBy('periodKey').reverse().toArray(), []) ?? []
  const [type, setType] = useState<ReviewPeriodType>('week')
  const today = todayKey()
  const currentKey = currentPeriodKey(type, today)

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Review</h2>

      <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-700 mb-3">
        {(['week', 'month'] as ReviewPeriodType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${
              type === t ? 'bg-white dark:bg-slate-900 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t}ly
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelect(type, currentKey)}
        className="w-full text-left p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 mb-3 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
      >
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Current {type} — {formatPeriodLabel(type, currentKey)}</p>
        <p className="text-xs text-indigo-600 dark:text-indigo-400">View or write this period's reflection</p>
      </button>

      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Past reviews</h3>
      {reviews.filter((r) => r.periodType === type).length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No past reviews yet for this period type.</p>
      ) : (
        <ul className="space-y-1.5">
          {reviews
            .filter((r) => r.periodType === type)
            .map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.periodType, r.periodKey)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                >
                  {formatPeriodLabel(r.periodType, r.periodKey)}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

export default function Review() {
  const [selected, setSelected] = useState<{ type: ReviewPeriodType; periodKey: string } | null>(null)

  if (selected) {
    return <ReviewDetail type={selected.type} periodKey={selected.periodKey} onBack={() => setSelected(null)} />
  }
  return <HistoryList onSelect={(type, periodKey) => setSelected({ type, periodKey })} />
}
