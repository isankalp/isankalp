import Dexie, { type Table } from 'dexie'
import { v4 as uuid } from 'uuid'
import { dbNameForProfile, getActiveProfileId } from '../lib/profiles'
import { wrapLocalTable } from './localTableWrapper'
import { getCloudTable, setCloudUserId } from './cloudTable'
import { emitDbChange } from './dbEvents'
import {
  DEFAULT_SETTINGS,
  type Badge,
  type CompletionEvent,
  type CompletionPhoto,
  type CustomFieldDef,
  type Day,
  type Goal,
  type Habit,
  type HabitLog,
  type JournalEntry,
  type Review,
  type Settings,
  type Task,
  type TaskHistoryEntry,
  type Template,
  type VoiceNote,
  type WebhookQueueItem,
} from './models'

export const ALL_TABLE_NAMES = [
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
  'completionPhotos',
  'journalEntries',
] as const

export type TableName = (typeof ALL_TABLE_NAMES)[number]

export class GoalsDB extends Dexie {
  tasks!: Table<Task, string>
  days!: Table<Day, string>
  goals!: Table<Goal, string>
  settings!: Table<Settings, string>
  habits!: Table<Habit, string>
  habitLogs!: Table<HabitLog, string>
  templates!: Table<Template, string>
  reviews!: Table<Review, string>
  badges!: Table<Badge, string>
  completionEvents!: Table<CompletionEvent, string>
  voiceNotes!: Table<VoiceNote, string>
  customFields!: Table<CustomFieldDef, string>
  taskHistory!: Table<TaskHistoryEntry, string>
  webhookQueue!: Table<WebhookQueueItem, string>
  completionPhotos!: Table<CompletionPhoto, string>
  journalEntries!: Table<JournalEntry, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      tasks: 'id, dayId, title, createdAt',
      days: 'id, &date',
      goals: 'id, title',
      settings: 'id',
    })
    this.version(2)
      .stores({
        tasks: 'id, dayId, title, createdAt, templateId',
        days: 'id, &date',
        goals: 'id, title',
        settings: 'id',
        habits: 'id, archivedAt',
        habitLogs: 'id, habitId, date, &[habitId+date]',
        templates: 'id, archivedAt',
        reviews: 'id, periodType, periodKey',
        badges: 'id, type',
      })
      .upgrade(async (tx) => {
        await tx
          .table('tasks')
          .toCollection()
          .modify((task) => {
            if (task.priority === undefined) task.priority = 'Medium'
          })
      })
    this.version(3).stores({
      tasks: 'id, dayId, title, createdAt, templateId, dependsOnTaskId',
      days: 'id, &date',
      goals: 'id, title, archivedAt',
      settings: 'id',
      habits: 'id, archivedAt',
      habitLogs: 'id, habitId, date, &[habitId+date]',
      templates: 'id, archivedAt',
      reviews: 'id, periodType, periodKey',
      badges: 'id, type',
      completionEvents: 'id, taskId, at',
      voiceNotes: 'id, taskId, createdAt',
    })
    this.version(4).stores({
      tasks: 'id, dayId, title, createdAt, templateId, dependsOnTaskId',
      days: 'id, &date',
      goals: 'id, title, archivedAt',
      settings: 'id',
      habits: 'id, archivedAt',
      habitLogs: 'id, habitId, date, &[habitId+date]',
      templates: 'id, archivedAt',
      reviews: 'id, periodType, periodKey',
      badges: 'id, type',
      completionEvents: 'id, taskId, at',
      voiceNotes: 'id, taskId, createdAt',
      customFields: 'id, name',
      taskHistory: 'id, taskId, at',
      webhookQueue: 'id, createdAt',
    })
    this.version(5)
      .stores({
        tasks: 'id, dayId, title, createdAt, templateId, dependsOnTaskId',
        days: 'id, &date',
        goals: 'id, title, archivedAt',
        settings: 'id',
        habits: 'id, archivedAt',
        habitLogs: 'id, habitId, date, &[habitId+date]',
        templates: 'id, archivedAt',
        reviews: 'id, periodType, periodKey',
        badges: 'id, type',
        completionEvents: 'id, taskId, at',
        voiceNotes: 'id, taskId, createdAt',
        customFields: 'id, name',
        taskHistory: 'id, taskId, at',
        webhookQueue: 'id, createdAt',
      })
      .upgrade(async (tx) => {
        // CU-5: every pre-existing task defaults to Minutes, with no data loss or re-entry.
        await tx
          .table('tasks')
          .toCollection()
          .modify((task) => {
            if (task.unit === undefined) task.unit = 'minutes'
          })
      })
    this.version(6).stores({
      tasks: 'id, dayId, title, createdAt, templateId, dependsOnTaskId',
      days: 'id, &date',
      goals: 'id, title, archivedAt',
      settings: 'id',
      habits: 'id, archivedAt',
      habitLogs: 'id, habitId, date, &[habitId+date]',
      templates: 'id, archivedAt',
      reviews: 'id, periodType, periodKey',
      badges: 'id, type',
      completionEvents: 'id, taskId, at',
      voiceNotes: 'id, taskId, createdAt',
      customFields: 'id, name',
      taskHistory: 'id, taskId, at',
      webhookQueue: 'id, createdAt',
      completionPhotos: 'id, taskId, completionEventId, createdAt',
    })
    this.version(7)
      .stores({
        tasks: 'id, dayId, title, createdAt, templateId, dependsOnTaskId',
        days: 'id, &date',
        goals: 'id, title, archivedAt',
        settings: 'id',
        habits: 'id, archivedAt',
        habitLogs: 'id, habitId, date, &[habitId+date]',
        templates: 'id, archivedAt',
        reviews: 'id, periodType, periodKey',
        badges: 'id, type',
        completionEvents: 'id, taskId, at',
        voiceNotes: 'id, taskId, createdAt',
        customFields: 'id, name',
        taskHistory: 'id, taskId, at',
        webhookQueue: 'id, createdAt',
        completionPhotos: 'id, taskId, completionEventId, createdAt',
        journalEntries: 'id, &date',
      })
      .upgrade(async (tx) => {
        // AK-5/JC-5: every pre-existing Settings row defaults to no AI usage yet and journal
        // analysis on (matching a fresh install), with no re-entry needed.
        await tx
          .table('settings')
          .toCollection()
          .modify((settings) => {
            if (settings.aiRequestCount === undefined) settings.aiRequestCount = 0
            if (settings.aiRequestCountSince === undefined) settings.aiRequestCountSince = Date.now()
            if (settings.journalAnalysisEnabled === undefined) settings.journalAnalysisEnabled = true
            if (settings.autoTaggingEnabled === undefined) settings.autoTaggingEnabled = true
          })
      })
  }
}

const localDb = new GoalsDB(dbNameForProfile(getActiveProfileId()))

const wrappedLocalTables = new Map<TableName, Table<unknown, string>>(
  ALL_TABLE_NAMES.map((name) => [name, wrapLocalTable(localDb[name] as Table<unknown, string>)]),
)

/** null = local-first (default, unauthenticated or accounts not configured); a user id = cloud mode. */
let activeUserId: string | null = null

export function isCloudMode(): boolean {
  return activeUserId !== null
}

/**
 * Called by AuthContext whenever the session changes. Flips every table this app reads/writes
 * through between the local Dexie database and the signed-in user's Supabase-backed cloud tables,
 * and notifies every mounted useLiveQuery so the UI refetches immediately against the new backend.
 */
export function setCloudMode(userId: string | null): void {
  if (activeUserId === userId) return
  activeUserId = userId
  setCloudUserId(userId)
  emitDbChange()
}

function getTable(name: TableName): Table<unknown, string> {
  if (activeUserId) return getCloudTable(name) as unknown as Table<unknown, string>
  const table = wrappedLocalTables.get(name)
  if (!table) throw new Error(`Unknown table: ${name}`)
  return table
}

/**
 * Always this device's local Dexie table, regardless of the currently active mode. Used by the
 * local-to-account migration, which by definition needs to read local data even while already
 * logged in (and therefore in cloud mode) so it knows what to push up.
 */
export function localTable<T = unknown>(name: TableName): Table<T, string> {
  const table = wrappedLocalTables.get(name)
  if (!table) throw new Error(`Unknown table: ${name}`)
  return table as unknown as Table<T, string>
}

/** Always the signed-in user's cloud table for `name`, regardless of the currently active mode. */
export function cloudTable<T = unknown>(name: TableName): Table<T, string> {
  return getCloudTable(name) as unknown as Table<T, string>
}

async function transaction<T>(_mode: 'rw', _tables: unknown, callback: () => Promise<T>): Promise<T> {
  if (!activeUserId) {
    // Local mode: use a real Dexie transaction across every local table for atomicity, exactly as before.
    return localDb.transaction('rw', localDb.tables, callback)
  }
  // Cloud mode: Postgrest has no client-side multi-statement transaction. Writes happen sequentially;
  // a mid-sequence failure can leave a partial result, same risk profile as any non-transactional REST API.
  const result = await callback()
  emitDbChange()
  return result
}

const dbHandler: ProxyHandler<Record<string, never>> = {
  get(_target, prop) {
    if (prop === 'transaction') return transaction
    if (prop === 'tables') return ALL_TABLE_NAMES.map((name) => getTable(name))
    if (prop === 'table') return (name: string) => getTable(name as TableName)
    if (typeof prop === 'string' && (ALL_TABLE_NAMES as readonly string[]).includes(prop)) {
      return getTable(prop as TableName)
    }
    return undefined
  },
}

/** The active data source — local Dexie by default, or the signed-in user's cloud tables once
 *  setCloudMode() is called. Every module in this app reads/writes through this single object. */
export const db = new Proxy({} as Record<string, never>, dbHandler) as unknown as GoalsDB

/** Returns today's Day (YYYY-MM-DD, local time), creating it if it doesn't exist yet. */
export async function getOrCreateDay(date: string): Promise<Day> {
  const existing = await db.days.where('date').equals(date).first()
  if (existing) return existing
  const day: Day = { id: uuid(), date }
  try {
    await db.days.add(day)
    return day
  } catch {
    // Another concurrent caller won the race to create this day (unique index on `date`).
    const winner = await db.days.where('date').equals(date).first()
    if (winner) return winner
    throw new Error(`Failed to get or create day for ${date}`)
  }
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('settings')
  if (existing) return { ...DEFAULT_SETTINGS, ...existing }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

/** Records a completedSubtasks change for Epic 10's time-of-day insight chart. Returns the event id so a
 *  positive (increment) change can optionally have a photo attached to it afterward (Epic 41). */
export async function logCompletionEvent(
  taskId: string,
  delta: number,
  spotifyTrackCount?: number,
  sessionActualMinutes?: number,
): Promise<string | null> {
  if (delta === 0) return null
  const id = uuid()
  const event: CompletionEvent = { id, taskId, delta, at: Date.now() }
  if (spotifyTrackCount !== undefined) event.spotifyTrackCount = spotifyTrackCount
  if (sessionActualMinutes !== undefined) event.sessionActualMinutes = sessionActualMinutes
  await db.completionEvents.add(event)
  return id
}

/** Applies a task patch while recording the previous values of the changed fields, for Epic 20's history/restore. */
export async function updateTaskTracked(task: Task, patch: Partial<Task>): Promise<void> {
  const changedKeys = Object.keys(patch) as (keyof Task)[]
  const previousValues = Object.fromEntries(changedKeys.map((key) => [key, task[key]])) as Partial<Task>
  await db.tasks.update(task.id, patch)
  await db.taskHistory.add({ id: uuid(), taskId: task.id, previousValues, at: Date.now() })
}
