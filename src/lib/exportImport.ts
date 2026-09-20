import { db, ALL_TABLE_NAMES } from '../db/db'
import { blobToDataUrl, dataUrlToBlob } from './blobUtils'
import type {
  Badge,
  CompletionEvent,
  CustomFieldDef,
  Day,
  Goal,
  Habit,
  HabitLog,
  Review,
  Settings,
  Task,
  TaskHistoryEntry,
  Template,
  WebhookQueueItem,
} from '../db/models'

interface VoiceNoteExport {
  id: string
  taskId: string
  /** Blob content as a data: URI so the whole backup is one JSON-serializable file (DC-1). */
  blobDataUrl: string
  mimeType: string
  createdAt: number
}

interface CompletionPhotoExport {
  id: string
  taskId: string
  completionEventId: string
  blobDataUrl: string
  mimeType: string
  createdAt: number
}

interface Backup {
  version: 3
  exportedAt: string
  tasks: Task[]
  days: Day[]
  goals: Goal[]
  settings: Settings | undefined
  habits: Habit[]
  habitLogs: HabitLog[]
  templates: Template[]
  reviews: Review[]
  badges: Badge[]
  completionEvents: CompletionEvent[]
  voiceNotes: VoiceNoteExport[]
  customFields: CustomFieldDef[]
  taskHistory: TaskHistoryEntry[]
  webhookQueue: WebhookQueueItem[]
  completionPhotos: CompletionPhotoExport[]
}

/** DC-1: a complete, machine-readable export of every task, goal, note, and setting — every table in the database. */
export async function exportData(): Promise<string> {
  const [
    tasks,
    days,
    goals,
    settings,
    habits,
    habitLogs,
    templates,
    reviews,
    badges,
    completionEvents,
    voiceNotesRaw,
    customFields,
    taskHistory,
    webhookQueue,
    completionPhotosRaw,
  ] = await Promise.all([
    db.tasks.toArray(),
    db.days.toArray(),
    db.goals.toArray(),
    db.settings.get('settings'),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.templates.toArray(),
    db.reviews.toArray(),
    db.badges.toArray(),
    db.completionEvents.toArray(),
    db.voiceNotes.toArray(),
    db.customFields.toArray(),
    db.taskHistory.toArray(),
    db.webhookQueue.toArray(),
    db.completionPhotos.toArray(),
  ])

  const voiceNotes: VoiceNoteExport[] = await Promise.all(
    voiceNotesRaw.map(async (v) => ({
      id: v.id,
      taskId: v.taskId,
      blobDataUrl: await blobToDataUrl(v.blob),
      mimeType: v.blob.type,
      createdAt: v.createdAt,
    })),
  )

  const completionPhotos: CompletionPhotoExport[] = await Promise.all(
    completionPhotosRaw.map(async (p) => ({
      id: p.id,
      taskId: p.taskId,
      completionEventId: p.completionEventId,
      blobDataUrl: await blobToDataUrl(p.blob),
      mimeType: p.blob.type,
      createdAt: p.createdAt,
    })),
  )

  const backup: Backup = {
    version: 3,
    exportedAt: new Date().toISOString(),
    tasks,
    days,
    goals,
    settings,
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
  return JSON.stringify(backup, null, 2)
}

export function downloadExport(json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `goals-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

type BackupFile = Omit<Backup, 'version'> & { version: number }

export async function importData(json: string): Promise<void> {
  const backup = JSON.parse(json) as BackupFile
  if (!backup || (backup.version !== 1 && backup.version !== 2 && backup.version !== 3)) {
    throw new Error('Unrecognized backup file format')
  }

  const voiceNotes =
    backup.version >= 2
      ? await Promise.all(
          (backup.voiceNotes ?? []).map(async (v) => ({
            id: v.id,
            taskId: v.taskId,
            blob: await dataUrlToBlob(v.blobDataUrl),
            createdAt: v.createdAt,
          })),
        )
      : []

  const completionPhotos =
    backup.version >= 3
      ? await Promise.all(
          (backup.completionPhotos ?? []).map(async (p) => ({
            id: p.id,
            taskId: p.taskId,
            completionEventId: p.completionEventId,
            blob: await dataUrlToBlob(p.blobDataUrl),
            mimeType: p.mimeType,
            createdAt: p.createdAt,
          })),
        )
      : []

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(ALL_TABLE_NAMES.map((name) => db.table(name).clear()))
    await db.days.bulkAdd(backup.days ?? [])
    await db.tasks.bulkAdd(backup.tasks ?? [])
    await db.goals.bulkAdd(backup.goals ?? [])
    if (backup.settings) await db.settings.put(backup.settings)
    await db.habits.bulkAdd(backup.habits ?? [])
    await db.habitLogs.bulkAdd(backup.habitLogs ?? [])
    await db.templates.bulkAdd(backup.templates ?? [])
    await db.reviews.bulkAdd(backup.reviews ?? [])
    await db.badges.bulkAdd(backup.badges ?? [])
    await db.completionEvents.bulkAdd(backup.completionEvents ?? [])
    await db.voiceNotes.bulkAdd(voiceNotes)
    await db.customFields.bulkAdd(backup.customFields ?? [])
    await db.taskHistory.bulkAdd(backup.taskHistory ?? [])
    await db.webhookQueue.bulkAdd(backup.webhookQueue ?? [])
    await db.completionPhotos.bulkAdd(completionPhotos)
  })
}

/**
 * DC-2: irreversibly clears every table in whichever store is currently active — this browser's
 * local storage for the active profile when logged out, or the signed-in account's cloud data
 * (the source every device syncs from) when logged in. Never both at once.
 */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(ALL_TABLE_NAMES.map((name) => db.table(name).clear()))
  })
  try {
    localStorage.removeItem('goals-tracker:onboarded')
    localStorage.removeItem('goals-tracker:rollover-dismissed')
  } catch {
    // localStorage unavailable — the Dexie wipe above already succeeded, which is what matters.
  }
}
