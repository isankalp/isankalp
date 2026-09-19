import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { logCompletionEvent } from '../db/db'
import { syncFromSubtaskItems, type SubtaskItem, type Task } from '../db/models'

/** GL-1/2: an editable named checklist that drives the same totalSubtasks/completedSubtasks math as numeric mode. */
export default function NamedSubtasks({ task }: { task: Task }) {
  const items = task.subtaskItems ?? []
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function persist(nextItems: SubtaskItem[]) {
    if (nextItems.length === 0) {
      setError('Add at least one subtask, or turn off named subtasks.')
      return
    }
    setError(null)
    const { totalSubtasks, completedSubtasks } = syncFromSubtaskItems(nextItems)
    const delta = completedSubtasks - task.completedSubtasks
    await db.tasks.update(task.id, {
      subtaskItems: nextItems,
      totalSubtasks,
      completedSubtasks,
      updatedAt: Date.now(),
    })
    await logCompletionEvent(task.id, delta)
  }

  function addItem() {
    const title = newTitle.trim()
    if (!title) return
    persist([...items, { id: uuid(), title, completed: false }])
    setNewTitle('')
  }

  function toggleItem(id: string) {
    persist(items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)))
  }

  function renameItem(id: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    persist(items.map((i) => (i.id === id ? { ...i, title: trimmed } : i)))
  }

  function removeItem(id: string) {
    persist(items.filter((i) => i.id !== id))
  }

  return (
    <div className="mt-2 space-y-1">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={item.completed} onChange={() => toggleItem(item.id)} aria-label={`Toggle ${item.title}`} />
            <input
              type="text"
              defaultValue={item.title}
              key={`${item.id}-${item.title}`}
              onBlur={(e) => renameItem(item.id, e.target.value)}
              maxLength={120}
              aria-label={`Subtask title: ${item.title}`}
              className={`flex-1 min-w-0 bg-transparent border-b border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-solid focus:border-indigo-500 focus:outline-none px-0.5 -mx-0.5 ${item.completed ? 'line-through text-slate-400' : ''}`}
            />
            <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.title}`} className="text-slate-400 hover:text-red-600">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addItem()
            }
          }}
          placeholder="Add subtask (e.g. Q1: Arrays)"
          maxLength={120}
          className="flex-1 min-w-0 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
        />
        <button type="button" onClick={addItem} className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">
          Add
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
