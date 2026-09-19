import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateTaskTracked } from '../db/db'
import type { Task } from '../db/models'

function formatFieldChange(key: string, value: unknown): string {
  if (value === undefined) return `${key}: (empty)`
  return `${key}: ${String(value)}`
}

/** DR-2/3: chronological list of past field changes, with a Restore that reverts the task to that snapshot. */
export default function TaskHistoryPanel({ task }: { task: Task }) {
  const entries = useLiveQuery(() => db.taskHistory.where('taskId').equals(task.id).reverse().sortBy('at'), [task.id]) ?? []

  if (entries.length === 0) {
    return <p className="mt-2 text-[11px] text-slate-400">No edits recorded yet.</p>
  }

  async function restore(previousValues: Partial<Task>) {
    await updateTaskTracked(task, previousValues)
  }

  return (
    <div className="mt-2 space-y-1.5">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px] p-1.5 rounded-md bg-slate-50 dark:bg-slate-900">
          <span className="text-slate-500 dark:text-slate-400">
            {new Date(entry.at).toLocaleString()} — {Object.entries(entry.previousValues).map(([k, v]) => formatFieldChange(k, v)).join(', ')}
          </span>
          <button type="button" onClick={() => restore(entry.previousValues)} className="shrink-0 underline font-medium text-indigo-600 dark:text-indigo-400">
            Restore
          </button>
        </div>
      ))}
    </div>
  )
}
