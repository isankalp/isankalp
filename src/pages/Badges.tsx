import { useLiveQuery } from '../hooks/useLiveQuery'
import { useState } from 'react'
import { db } from '../db/db'
import { MINUTES_HOUR_MILESTONES, STREAK_MILESTONES, badgeLabel } from '../lib/badges'
import type { BadgeType } from '../db/models'

interface BadgeSlot {
  id: string
  type: BadgeType
  milestone: number
  earnedAt?: number
}

export default function Badges() {
  const earned = useLiveQuery(() => db.badges.toArray(), []) ?? []
  const earnedById = new Map(earned.map((b) => [b.id, b]))
  const [selected, setSelected] = useState<BadgeSlot | null>(null)

  const slots: BadgeSlot[] = [
    ...STREAK_MILESTONES.map((m) => ({ id: `streak-${m}`, type: 'streak' as const, milestone: m })),
    ...MINUTES_HOUR_MILESTONES.map((m) => ({ id: `minutes-${m}`, type: 'minutes' as const, milestone: m })),
  ].map((slot) => ({ ...slot, earnedAt: earnedById.get(slot.id)?.earnedAt }))

  const hasAny = slots.some((s) => s.earnedAt)

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">Badges</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {hasAny ? 'Earned badges are colored; locked ones show what you need.' : 'Keep going — your first badge is close.'}
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {slots.map((slot) => {
          const isEarned = !!slot.earnedAt
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setSelected(slot)}
              className={
                isEarned
                  ? 'flex flex-col items-center gap-1 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 grayscale opacity-60'
              }
            >
              <span className="text-3xl">{slot.type === 'streak' ? '🔥' : '⏱️'}</span>
              <span className="text-[11px] text-center font-medium">{badgeLabel(slot.type, slot.milestone)}</span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-4 max-w-xs w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-4xl">{selected.type === 'streak' ? '🔥' : '⏱️'}</span>
            <p className="font-semibold mt-2">{badgeLabel(selected.type, selected.milestone)}</p>
            {selected.earnedAt ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Earned {new Date(selected.earnedAt).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Keep going to unlock this one.</p>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-3 px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
