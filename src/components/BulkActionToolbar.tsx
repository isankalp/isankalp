import { useState } from 'react'
import { bulkDelete, bulkDuplicate, bulkMove, bulkTag } from '../lib/bulkOps'
import type { Task } from '../db/models'

const CATEGORY_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#a855f7']

/** BO-1..5: appears once at least one task is selected; every action applies identically to all of them. */
export default function BulkActionToolbar({ selectedTasks, onDone }: { selectedTasks: Task[]; onDone: () => void }) {
  const [moveDate, setMoveDate] = useState('')
  const [duplicateDate, setDuplicateDate] = useState('')
  const [tagOpen, setTagOpen] = useState(false)
  const [tagLabel, setTagLabel] = useState('')
  const [tagColor, setTagColor] = useState(CATEGORY_COLORS[0])
  const [tagIcon, setTagIcon] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const ids = selectedTasks.map((t) => t.id)
  const count = ids.length

  async function handleMove() {
    if (!moveDate) return
    setBusy(true)
    await bulkMove(ids, moveDate)
    setBusy(false)
    onDone()
  }

  async function handleDuplicate() {
    if (!duplicateDate) return
    setBusy(true)
    await bulkDuplicate(selectedTasks, duplicateDate)
    setBusy(false)
    onDone()
  }

  async function handleTag() {
    if (!tagLabel.trim()) return
    setBusy(true)
    await bulkTag(ids, { label: tagLabel.trim(), color: tagColor, icon: tagIcon.trim() || '🏷️' })
    setBusy(false)
    setTagOpen(false)
    onDone()
  }

  async function handleDelete() {
    setBusy(true)
    await bulkDelete(selectedTasks)
    setBusy(false)
    setConfirmDelete(false)
    onDone()
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold">{count} selected</span>

      <div className="flex items-center gap-1">
        <input
          type="date"
          value={moveDate}
          onChange={(e) => setMoveDate(e.target.value)}
          aria-label="Move selected tasks to date"
          className="px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={handleMove}
          disabled={!moveDate || busy}
          className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800"
        >
          Move to…
        </button>
      </div>

      <div className="flex items-center gap-1">
        <input
          type="date"
          value={duplicateDate}
          onChange={(e) => setDuplicateDate(e.target.value)}
          aria-label="Duplicate selected tasks to date"
          className="px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={!duplicateDate || busy}
          className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800"
        >
          Duplicate to…
        </button>
      </div>

      <button
        type="button"
        onClick={() => setTagOpen((v) => !v)}
        className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800"
      >
        🏷️ Tag
      </button>

      <button type="button" onClick={() => setConfirmDelete(true)} className="px-2 py-1 rounded-md bg-red-600 text-white font-medium hover:bg-red-700">
        Delete
      </button>

      <button type="button" onClick={onDone} className="ml-auto text-slate-500 dark:text-slate-400 underline">
        Cancel
      </button>

      {tagOpen && (
        <div className="w-full flex items-center gap-1.5 flex-wrap pt-2 border-t border-indigo-200 dark:border-indigo-700 mt-1">
          <input
            type="text"
            value={tagLabel}
            onChange={(e) => setTagLabel(e.target.value)}
            placeholder="Tag (e.g. Work)"
            maxLength={30}
            aria-label="Bulk tag label"
            className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-28"
          />
          <input
            type="text"
            value={tagIcon}
            onChange={(e) => setTagIcon(e.target.value.slice(0, 2))}
            placeholder="🏷️"
            aria-label="Bulk tag icon"
            className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-10 text-center"
          />
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTagColor(c)}
              aria-label={`Color ${c}`}
              className={`w-4 h-4 rounded-full ${tagColor === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onClick={handleTag}
            disabled={!tagLabel.trim() || busy}
            className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-medium disabled:opacity-30"
          >
            Apply to {count}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4" onClick={() => setConfirmDelete(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-lg border border-red-300 dark:border-red-700 w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm text-red-600 dark:text-red-400 mb-2">
              Delete {count} task{count === 1 ? '' : 's'}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">This cannot be undone from here, but Undo (Ctrl/Cmd+Z) works right after.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                Delete {count}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
