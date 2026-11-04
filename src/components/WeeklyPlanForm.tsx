import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { WeeklyPlan } from '../db/models'
import { validateWeeklyPlanPeriod, weeklyPlanState } from '../lib/weekly'

interface Props {
  plan?: WeeklyPlan
  onSaved: (plan: WeeklyPlan) => void
  onCancel: () => void
}

/** Epic 92 (WP-1..6): create or edit a plan's name and From/To period. WP-5: editing an existing
 *  plan's dates recalculates its deadline countdown immediately, since WeeklyDeadlineBar always
 *  derives live from the stored plan — no separate recompute step needed here. */
export default function WeeklyPlanForm({ plan, onSaved, onCancel }: Props) {
  const [name, setName] = useState(plan?.name ?? '')
  const [fromDate, setFromDate] = useState(plan?.fromDate ?? '')
  const [fromTime, setFromTime] = useState(plan?.fromTime ?? '')
  const [toDate, setToDate] = useState(plan?.toDate ?? '')
  const [toTime, setToTime] = useState(plan?.toTime ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const isActivePlan = plan ? weeklyPlanState(plan) === 'active' : false
    const result = validateWeeklyPlanPeriod(fromDate, fromTime, toDate, toTime, { isActivePlan })
    if (!result.valid) {
      setFieldErrors(result.fieldErrors)
      setGeneralError(result.generalError ?? null)
      return
    }
    setFieldErrors({})
    setGeneralError(null)
    setSaving(true)
    try {
      const now = Date.now()
      if (plan) {
        const updated: WeeklyPlan = { ...plan, name, fromDate, fromTime, toDate, toTime, updatedAt: now }
        await db.weeklyPlans.update(plan.id, { name, fromDate, fromTime, toDate, toTime, updatedAt: now })
        onSaved(updated)
      } else {
        const created: WeeklyPlan = { id: uuid(), name, fromDate, fromTime, toDate, toTime, createdAt: now, updatedAt: now }
        await db.weeklyPlans.add(created)
        onSaved(created)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-800 p-4 space-y-3">
        <p className="text-sm font-semibold">{plan ? 'Edit Weekly Plan' : 'New Weekly Plan'}</p>

        <div className="space-y-1.5 text-xs">
          <label className="block">
            <span className="text-slate-500 dark:text-slate-400">Name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Sprint 1" — defaults to "Week of [From date]"'
              maxLength={80}
              className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-slate-500 dark:text-slate-400">From date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="From date"
                className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              {fieldErrors.fromDate && <p className="text-red-600 dark:text-red-400 mt-0.5">{fieldErrors.fromDate}</p>}
            </label>
            <label className="block">
              <span className="text-slate-500 dark:text-slate-400">From time</span>
              <input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                aria-label="From time"
                className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              {fieldErrors.fromTime && <p className="text-red-600 dark:text-red-400 mt-0.5">{fieldErrors.fromTime}</p>}
            </label>
            <label className="block">
              <span className="text-slate-500 dark:text-slate-400">To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="To date"
                className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              {fieldErrors.toDate && <p className="text-red-600 dark:text-red-400 mt-0.5">{fieldErrors.toDate}</p>}
            </label>
            <label className="block">
              <span className="text-slate-500 dark:text-slate-400">To time</span>
              <input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                aria-label="To time"
                className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              {fieldErrors.toTime && <p className="text-red-600 dark:text-red-400 mt-0.5">{fieldErrors.toTime}</p>}
            </label>
          </div>

          {generalError && <p className="text-red-600 dark:text-red-400">{generalError}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
