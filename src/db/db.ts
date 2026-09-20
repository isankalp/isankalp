import Dexie, { type Table } from 'dexie'
import { v4 as uuid } from 'uuid'
import { dbNameForProfile, getActiveProfileId } from '../lib/profiles'
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
  type Review,
  type Settings,
  type Task,
  type TaskHistoryEntry,
  type Template,
  type VoiceNote,
  type WebhookQueueItem,
} from './models'

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
  }
}

export const db = new GoalsDB(dbNameForProfile(getActiveProfileId()))

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
export async function logCompletionEvent(taskId: string, delta: number): Promise<string | null> {
  if (delta === 0) return null
  const id = uuid()
  await db.completionEvents.add({ id, taskId, delta, at: Date.now() })
  return id
}

/** Applies a task patch while recording the previous values of the changed fields, for Epic 20's history/restore. */
export async function updateTaskTracked(task: Task, patch: Partial<Task>): Promise<void> {
  const changedKeys = Object.keys(patch) as (keyof Task)[]
  const previousValues = Object.fromEntries(changedKeys.map((key) => [key, task[key]])) as Partial<Task>
  await db.tasks.update(task.id, patch)
  await db.taskHistory.add({ id: uuid(), taskId: task.id, previousValues, at: Date.now() })
}
