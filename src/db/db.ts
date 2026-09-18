import Dexie, { type Table } from 'dexie'
import { v4 as uuid } from 'uuid'
import { DEFAULT_SETTINGS, type Day, type Goal, type Settings, type Task } from './models'

export class GoalsDB extends Dexie {
  tasks!: Table<Task, string>
  days!: Table<Day, string>
  goals!: Table<Goal, string>
  settings!: Table<Settings, string>

  constructor() {
    super('goals-tracker')
    this.version(1).stores({
      tasks: 'id, dayId, title, createdAt',
      days: 'id, &date',
      goals: 'id, title',
      settings: 'id',
    })
  }
}

export const db = new GoalsDB()

/** Returns today's Day (YYYY-MM-DD, local time), creating it if it doesn't exist yet. */
export async function getOrCreateDay(date: string): Promise<Day> {
  const existing = await db.days.where('date').equals(date).first()
  if (existing) return existing
  const day: Day = { id: uuid(), date }
  await db.days.add(day)
  return day
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('settings')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}
