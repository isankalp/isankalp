import { useRef, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { buildTaskExport, downloadTaskExportCsv } from '../lib/taskExport'
import { useToast } from '../context/ToastContext'

/** Epic 87: a one-tap export of every task ever added, visible in the Tasks screen header on every
 *  day. EX-4: disabled with a tooltip when the account has zero tasks. EX-5: a second tap while
 *  exporting is ignored — the button shows a spinner and is disabled for the duration. EX-6/EX-7:
 *  success shows a row-count toast and downloads the file; failure shows an error toast and
 *  downloads nothing, leaving the button active again. EX-8: read-only, no stored data changes. */
export default function ExportTasksButton() {
  const taskCount = useLiveQuery(() => db.tasks.count(), []) ?? 0
  const [exporting, setExporting] = useState(false)
  // EX-5: a plain ref, not render-batched state, so two clicks dispatched back-to-back in the same
  // tick (before React re-renders the disabled attribute) still can't both start an export.
  const exportingRef = useRef(false)
  const { showToast } = useToast()

  const hasTasks = taskCount > 0
  const disabled = !hasTasks || exporting

  async function handleExport() {
    if (!hasTasks || exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    try {
      const result = await buildTaskExport()
      downloadTaskExportCsv(result)
      showToast(`Exported ${result.rowCount} task${result.rowCount === 1 ? '' : 's'}`, 'success')
    } catch {
      showToast('Export failed — try again', 'error')
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
      title={!hasTasks ? 'No tasks to export' : undefined}
      aria-label="Export Tasks"
      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
    >
      <span aria-hidden>{exporting ? '⏳' : '⬇'}</span>
      Export Tasks
    </button>
  )
}
