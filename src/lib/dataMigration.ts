import { ALL_TABLE_NAMES, cloudTable, localTable } from '../db/db'
import type { Day } from '../db/models'
import { blobToDataUrl } from './blobUtils'
import { requireSupabase } from './supabaseClient'

const MIGRATION_DONE_PREFIX = 'goals-tracker:migrationDone:'
const BACKUP_BUCKET = 'account-backups'

/** DM-1: only prompts when there's actually something to migrate. Always reads this device's LOCAL
 *  data specifically — by the time this runs the user is already logged in, so the app's default
 *  `db` is already pointed at the (likely still-empty) cloud tables. */
export async function hasLocalData(): Promise<boolean> {
  const [taskCount, goalCount] = await Promise.all([localTable('tasks').count(), localTable('goals').count()])
  return taskCount > 0 || goalCount > 0
}

export interface MigrationSummary {
  taskCount: number
  goalCount: number
  earliestDate: string | null
  latestDate: string | null
}

export async function buildMigrationSummary(): Promise<MigrationSummary> {
  const [taskCount, goalCount, days] = await Promise.all([
    localTable('tasks').count(),
    localTable('goals').count(),
    localTable<Day>('days').orderBy('date').toArray(),
  ])
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
 * DM-2/DM-3/DM-4: copies every local table's rows into this account's cloud tables, so all of this
 * device's history becomes part of the account (visible from any device from then on). Reads local
 * data but never writes to it — a failed or partial migration never touches the on-device copy, and
 * re-running it (e.g. after clicking Retry) is safe since every row is written with `put` (upsert),
 * not `add`.
 */
export async function migrateLocalDataToCloud(): Promise<void> {
  for (const name of ALL_TABLE_NAMES) {
    const rows = await localTable(name).toArray()
    if (rows.length === 0) continue
    await Promise.all(rows.map((row) => cloudTable(name).put(row)))
  }
}

/**
 * Best-effort extra safety net alongside the real migration above: a portable JSON snapshot of this
 * device's local data (same format as Settings → Export All Data), attached to the account. Its
 * failure never fails the migration as a whole — the cloud tables above are the data that matters.
 */
export async function uploadLocalBackupToAccount(userId: string): Promise<void> {
  const client = await requireSupabase()
  const [tasks, days, goals, settingsRows, habits, habitLogs, templates, reviews, badges, completionEvents, voiceNotesRaw, customFields, taskHistory, webhookQueue, completionPhotosRaw] =
    await Promise.all(ALL_TABLE_NAMES.map((name) => localTable(name).toArray()))
  const voiceNotes = await Promise.all(
    (voiceNotesRaw as { id: string; taskId: string; blob: Blob; createdAt: number }[]).map(async (v) => ({
      id: v.id,
      taskId: v.taskId,
      blobDataUrl: await blobToDataUrl(v.blob),
      mimeType: v.blob.type,
      createdAt: v.createdAt,
    })),
  )
  const completionPhotos = await Promise.all(
    (completionPhotosRaw as { id: string; taskId: string; completionEventId: string; blob: Blob; mimeType: string; createdAt: number }[]).map(
      async (p) => ({
        id: p.id,
        taskId: p.taskId,
        completionEventId: p.completionEventId,
        blobDataUrl: await blobToDataUrl(p.blob),
        mimeType: p.mimeType,
        createdAt: p.createdAt,
      }),
    ),
  )
  const backup = {
    version: 3,
    exportedAt: new Date().toISOString(),
    tasks,
    days,
    goals,
    settings: settingsRows[0],
    habits,
    habitLogs,
    templates,
    reviews,
    badges,
    completionEvents,
    voiceNotes,
    customFields,
    taskHistory,
    webhookQueue,
    completionPhotos,
  }
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const path = `${userId}/migration-${Date.now()}.json`
  const { error } = await client.storage.from(BACKUP_BUCKET).upload(path, blob, { contentType: 'application/json' })
  if (error) throw error
}
