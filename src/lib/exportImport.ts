import { db } from '../db/db'
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

interface Backup {
  version: 2
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
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** DC-1: a complete, machine-readable export of every task, goal, note, and setting — every table in the database. */
export async function exportData(): Promise<string> {
  const [tasks, days, goals, settings, habits, habitLogs, templates, reviews, badges, completionEvents, voiceNotesRaw, customFields, taskHistory, webhookQueue] =
    await Promise.all([
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

  const backup: Backup = {
    version: 2,
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

const ALL_TABLES = [
  'tasks',
  'days',
  'goals',
  'settings',
  'habits',
  'habitLogs',
  'templates',
  'reviews',
  'badges',
  'completionEvents',
  'voiceNotes',
  'customFields',
  'taskHistory',
  'webhookQueue',
] as const

type BackupFile = Omit<Backup, 'version'> & { version: number }

export async function importData(json: string): Promise<void> {
  const backup = JSON.parse(json) as BackupFile
  if (!backup || (backup.version !== 1 && backup.version !== 2)) {
    throw new Error('Unrecognized backup file format')
  }

  const voiceNotes =
    backup.version === 2
      ? await Promise.all(
          (backup.voiceNotes ?? []).map(async (v) => ({
            id: v.id,
            taskId: v.taskId,
            blob: await dataUrlToBlob(v.blobDataUrl),
            createdAt: v.createdAt,
          })),
        )
      : []

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(ALL_TABLES.map((name) => db.table(name).clear()))
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
  })
}

/**
 * DC-2 scoped to a backend-less, local-first app: irreversibly clears every table in this profile's
 * database. There is no "account" or server/sync copy to also purge — honestly, this only ever
 * affects this browser's local storage for the active profile.
 */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(ALL_TABLES.map((name) => db.table(name).clear()))
  })
  try {
    localStorage.removeItem('goals-tracker:onboarded')
    localStorage.removeItem('goals-tracker:rollover-dismissed')
  } catch {
    // localStorage unavailable — the Dexie wipe above already succeeded, which is what matters.
  }
}
