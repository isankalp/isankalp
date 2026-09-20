import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  buildMigrationSummary,
  hasLocalData,
  markMigrationResolved,
  migrateLocalDataToCloud,
  migrationResolvedForDevice,
  uploadLocalBackupToAccount,
  type MigrationSummary,
} from '../lib/dataMigration'

type Status = 'checking' | 'hidden' | 'prompt' | 'uploading' | 'error' | 'done'

/** Epic 52: offers to bring this device's existing local data into the account. The real move is
 *  copying every table into the account's cloud tables (so it's visible from any device from then
 *  on); a JSON backup snapshot is also attached to the account as a best-effort extra safety net,
 *  but its failure alone never blocks the migration from completing. */
export default function DataMigrationPrompt() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('checking')
  const [summary, setSummary] = useState<MigrationSummary | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function check() {
      if (migrationResolvedForDevice(user!.id)) {
        setStatus('hidden')
        return
      }
      const hasData = await hasLocalData()
      if (cancelled) return
      if (!hasData) {
        markMigrationResolved(user!.id)
        setStatus('hidden')
        return
      }
      setSummary(await buildMigrationSummary())
      if (!cancelled) setStatus('prompt')
    }
    check()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user || status === 'checking' || status === 'hidden' || status === 'done') return null

  async function handleImport() {
    setStatus('uploading')
    try {
      await migrateLocalDataToCloud()
      await uploadLocalBackupToAccount(user!.id).catch(() => undefined)
      markMigrationResolved(user!.id)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  function handleStartFresh() {
    // DM-3: local data is left untouched on-device — this only stops the prompt from reappearing.
    markMigrationResolved(user!.id)
    setStatus('done')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-sm p-4">
        <h3 className="font-semibold text-sm mb-1">Import your existing data into this account?</h3>

        {status === 'error' && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">Something went wrong — your local data is safe.</p>
        )}

        {status === 'uploading' ? (
          <div className="py-4">
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '70%' }} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">Uploading…</p>
          </div>
        ) : (
          <>
            {summary && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Found {summary.taskCount} task{summary.taskCount === 1 ? '' : 's'} and {summary.goalCount} goal
                {summary.goalCount === 1 ? '' : 's'} on this device
                {summary.earliestDate && summary.latestDate ? `, from ${summary.earliestDate} to ${summary.latestDate}` : ''}.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImport}
                className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
              >
                {status === 'error' ? 'Retry' : 'Import'}
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Start fresh instead
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
