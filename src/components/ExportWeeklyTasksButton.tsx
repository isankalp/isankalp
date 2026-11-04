import { useRef, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { buildWeeklyTaskExport, downloadWeeklyTaskExportCsv } from '../lib/weeklyExport'
import { useToast } from '../context/ToastContext'

/** Epic 97: a one-tap export of every weekly task across every plan and state, visible on the
 *  Weekly screen header. WX-10: disabled with a tooltip when there are zero weekly tasks. WX-13: a
 *  second tap while exporting is ignored — guarded by a ref (not just render-batched state) so two
 *  clicks dispatched in the same tick still can't start a second export (same fix v16's daily
 *  Export Tasks button needed). WX-11/WX-12: success shows a task-and-row-count toast and
 *  downloads the file; failure shows an error toast and downloads nothing, button active again.
 *  WX-15: read-only. */
export default function ExportWeeklyTasksButton() {
  const taskCount = useLiveQuery(() => db.weeklyTasks.count(), []) ?? 0
  const [exporting, setExporting] = useState(false)
  const exportingRef = useRef(false)
  const { showToast } = useToast()

  const hasTasks = taskCount > 0
  const disabled = !hasTasks || exporting

  async function handleExport() {
    if (!hasTasks || exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    try {
      const result = await buildWeeklyTaskExport()
      downloadWeeklyTaskExportCsv(result)
      showToast(
        `Exported ${result.taskCount} task${result.taskCount === 1 ? '' : 's'} (${result.rowCount} row${result.rowCount === 1 ? '' : 's'})`,
        'success',
      )
    } catch {
      showToast('Export failed, try again', 'error')
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      title={!hasTasks ? 'No weekly tasks to export' : 'Exports one row per subtask'}
      aria-label="Export Weekly Tasks"
      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
    >
      <span aria-hidden>{exporting ? '⏳' : '⬇'}</span>
      Export Weekly Tasks
    </button>
  )
}
