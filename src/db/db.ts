import Dexie, { type Table } from 'dexie'
import { v4 as uuid } from 'uuid'
import {
  DEFAULT_SETTINGS,
  type Badge,
  type Day,
  type Goal,
  type Habit,
  type HabitLog,
  type Review,
  type Settings,
  type Task,
  type Template,
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

  constructor() {
    super('goals-tracker')
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
  }
}

export const db = new GoalsDB()

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
