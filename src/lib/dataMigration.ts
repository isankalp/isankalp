import { db } from '../db/db'
import { exportData } from './exportImport'
import { requireSupabase } from './supabaseClient'

const MIGRATION_DONE_PREFIX = 'goals-tracker:migrationDone:'
const BACKUP_BUCKET = 'account-backups'

/** DM-1: only prompts when there's actually something to migrate. */
export async function hasLocalData(): Promise<boolean> {
  const [taskCount, goalCount] = await Promise.all([db.tasks.count(), db.goals.count()])
  return taskCount > 0 || goalCount > 0
}

export interface MigrationSummary {
  taskCount: number
  goalCount: number
  earliestDate: string | null
  latestDate: string | null
}

export async function buildMigrationSummary(): Promise<MigrationSummary> {
  const [taskCount, goalCount, days] = await Promise.all([db.tasks.count(), db.goals.count(), db.days.orderBy('date').toArray()])
  return {
    taskCount,
    goalCount,
    earliestDate: days[0]?.date ?? null,
    latestDate: days[days.length - 1]?.date ?? null,
  }
}

/** DM-5: migration is offered once per device per account — never re-prompted after it resolves,
 *  whether the user imported or explicitly started fresh. */
export function migrationResolvedForDevice(userId: string): boolean {
  try {
    return localStorage.getItem(MIGRATION_DONE_PREFIX + userId) === 'true'
  } catch {
    return false
  }
}

export function markMigrationResolved(userId: string): void {
  try {
    localStorage.setItem(MIGRATION_DONE_PREFIX + userId, 'true')
  } catch {
    // localStorage unavailable — worst case the prompt reappears next login, non-destructive either way
  }
}

/**
 * DM-2/DM-4: uploads the full local export (same format as Settings → Export All Data) as one
 * backup file attached to the account. Reads local data but never writes to it — a failed or
 * successful upload never touches the on-device copy (DM-3/DM-4).
 */
export async function uploadBackupToAccount(userId: string): Promise<void> {
  const client = await requireSupabase()
  const json = await exportData()
  const blob = new Blob([json], { type: 'application/json' })
  const path = `${userId}/migration-${Date.now()}.json`
  const { error } = await client.storage.from(BACKUP_BUCKET).upload(path, blob, { contentType: 'application/json' })
  if (error) throw error
}
