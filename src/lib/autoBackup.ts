import { db } from '../db/db'
import { downloadExport, exportData } from './exportImport'
import type { Settings } from '../db/models'

/** DR-4/5: runs a full export on the configured interval; any failure is recorded, never silent. */
export async function checkAutoBackup(settings: Settings): Promise<void> {
  if (!settings.autoBackupEnabled) return
  const intervalMs = settings.autoBackupIntervalDays * 24 * 60 * 60 * 1000
  const last = settings.lastAutoBackupAt ?? 0
  if (Date.now() - last < intervalMs) return

  try {
    const json = await exportData()
    downloadExport(json)
    await db.settings.update('settings', { lastAutoBackupAt: Date.now(), lastAutoBackupFailedAt: undefined })
  } catch {
    await db.settings.update('settings', { lastAutoBackupFailedAt: Date.now() })
  }
}
