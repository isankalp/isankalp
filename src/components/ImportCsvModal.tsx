import { useRef, useState } from 'react'
import { parseCsv } from '../lib/csv'
import { buildImportRows, commitImport, isMappingValid, type ColumnMapping, type ImportRow } from '../lib/csvImport'

const FIELD_LABELS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'minutesPerSubtask', label: 'Minutes per subtask' },
  { key: 'totalSubtasks', label: 'Total subtasks' },
]

export default function ImportCsvModal({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [headers, setHeaders] = useState<string[] | null>(null)
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ title: null, minutesPerSubtask: null, totalSubtasks: null })
  const [targetDate, setTargetDate] = useState(defaultDate)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) {
        setError('That file has no rows.')
        return
      }
      setHeaders(rows[0])
      setDataRows(rows.slice(1))
      // Best-effort auto-map by header name.
      const findCol = (name: string) => rows[0].findIndex((h) => h.trim().toLowerCase() === name.toLowerCase())
      setMapping({
        title: findCol('title') >= 0 ? findCol('title') : null,
        minutesPerSubtask: findCol('minutesPerSubtask') >= 0 ? findCol('minutesPerSubtask') : null,
        totalSubtasks: findCol('totalSubtasks') >= 0 ? findCol('totalSubtasks') : null,
      })
    } catch {
      setError('Could not read that file as CSV.')
    }
  }

  const previewRows: ImportRow[] = headers ? buildImportRows(dataRows, mapping) : []
  const validCount = previewRows.filter((r) => r.valid).length
  const failedCount = previewRows.length - validCount

  async function handleImport() {
    setImporting(true)
    try {
      const imported = await commitImport(previewRows, targetDate)
      setResult({ imported })
    } catch {
      setError('Import failed — nothing was written.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Import CSV</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm" aria-label="Close import dialog">
            ✕
          </button>
        </div>

        {result ? (
          <div className="text-center py-8">
            <p className="text-sm font-medium mb-3">Imported {result.imported} task{result.imported === 1 ? '' : 's'}.</p>
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              Done
            </button>
          </div>
        ) : !headers ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Drop a CSV file to begin, or click to choose one
            </button>
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {FIELD_LABELS.map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Target day:</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>

            {isMappingValid(mapping) && (
              <>
                <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="text-left px-2 py-1 font-medium">Title</th>
                        <th className="text-right px-2 py-1 font-medium">Min/subtask</th>
                        <th className="text-right px-2 py-1 font-medium">Subtasks</th>
                        <th className="text-left px-2 py-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={row.valid ? '' : 'bg-red-50 dark:bg-red-500/10'}
                          title={row.reason}
                        >
                          <td className="px-2 py-1">{row.title || <span className="text-slate-400">(empty)</span>}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{row.minutesPerSubtaskRaw}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{row.totalSubtasksRaw}</td>
                          <td className="px-2 py-1">
                            {row.valid ? (
                              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">{row.reason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {failedCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {failedCount} row{failedCount === 1 ? '' : 's'} failed and will be skipped.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                  className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40"
                >
                  {importing ? 'Importing…' : `Import ${validCount} task${validCount === 1 ? '' : 's'}`}
                </button>
              </>
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
