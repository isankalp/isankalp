import { useLiveQuery } from '../hooks/useLiveQuery'
import { useEffect } from 'react'
import { db } from '../db/db'
import { badgeLabel } from '../lib/badges'

export default function BadgeToast() {
  const unnotified = useLiveQuery(() => db.badges.filter((b) => !b.notifiedAt).toArray(), []) ?? []
  const badge = unnotified[0]

  useEffect(() => {
    if (!badge) return
    const timer = setTimeout(() => {
      db.badges.update(badge.id, { notifiedAt: Date.now() })
    }, 4000)
    return () => clearTimeout(timer)
  }, [badge])

  if (!badge) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium shadow-lg flex items-center gap-2">
      🏆 New badge: {badgeLabel(badge.type, badge.milestone)}
    </div>
  )
}
