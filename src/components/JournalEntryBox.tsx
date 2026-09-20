import { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'

/** Minimal journal entry per day — the real feature Epic 57's Journal Coaching needed (never built
 *  under its own epic in this app, see PR notes). One free-text entry per date, same save-on-blur
 *  pattern as the Weekly/Monthly Review's reflection field. */
export default function JournalEntryBox({ date }: { date: string }) {
  const entry = useLiveQuery(() => db.journalEntries.where('date').equals(date).first(), [date])
  const [saved, setSaved] = useState(false)

  async function handleBlur(text: string) {
    const trimmed = text.trim()
    const now = Date.now()
    if (!trimmed) {
      if (entry) await db.journalEntries.delete(entry.id)
      return
    }
    if (entry) {
      await db.journalEntries.update(entry.id, { text: trimmed, updatedAt: now })
    } else {
      await db.journalEntries.add({ id: uuid(), date, text: trimmed, createdAt: now, updatedAt: now })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Journal</label>
        {saved && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
      <textarea
        key={date}
        defaultValue={entry?.text ?? ''}
        onBlur={(e) => handleBlur(e.target.value)}
        placeholder="How's today going?"
        rows={2}
        maxLength={4000}
        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-y"
      />
    </div>
  )
}
