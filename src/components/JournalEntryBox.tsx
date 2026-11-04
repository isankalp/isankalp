import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'

export interface JournalEntryBoxHandle {
  /** LR-11: forces a save of whatever is currently in the textarea, bypassing the need for blur —
   *  used by the day-navigation guard's "Save" action. */
  flush: () => Promise<void>
}

interface Props {
  date: string
  /** LR-11: fires whenever the textarea's live value starts/stops differing from the saved entry,
   *  so a parent can warn before navigating away with unsaved text. */
  onDirtyChange?: (dirty: boolean) => void
}

/** Minimal journal entry per day — the real feature Epic 57's Journal Coaching needed (never built
 *  under its own epic in this app, see PR notes). One free-text entry per date, same save-on-blur
 *  pattern as the Weekly/Monthly Review's reflection field. */
const JournalEntryBox = forwardRef<JournalEntryBoxHandle, Props>(function JournalEntryBox({ date, onDirtyChange }, ref) {
  const entry = useLiveQuery(() => db.journalEntries.where('date').equals(date).first(), [date])
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const baselineRef = useRef(entry?.text ?? '')

  useEffect(() => {
    baselineRef.current = entry?.text ?? ''
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resets the dirty baseline only when the day (or its loaded entry) actually changes
  }, [date, entry?.id])

  async function doSave(text: string) {
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
    baselineRef.current = trimmed
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function handleInput() {
    const value = textareaRef.current?.value ?? ''
    onDirtyChange?.(value.trim() !== baselineRef.current.trim())
  }

  useImperativeHandle(ref, () => ({
    flush: async () => {
      if (!textareaRef.current) return
      await doSave(textareaRef.current.value)
      onDirtyChange?.(false)
    },
  }))

  async function handleBlur(text: string) {
    await doSave(text)
    onDirtyChange?.(false)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Journal</label>
        {saved && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
      <textarea
        key={date}
        ref={textareaRef}
        defaultValue={entry?.text ?? ''}
        onChange={handleInput}
        onBlur={(e) => handleBlur(e.target.value)}
        placeholder="How's today going?"
        rows={2}
        maxLength={4000}
        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-y"
      />
    </div>
  )
})

export default JournalEntryBox
