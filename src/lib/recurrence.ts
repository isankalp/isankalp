import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { addDays, todayKey } from './date'

/**
 * Ensures a task exists for every matching weekday of every active recurring
 * template, for today through `daysAhead` days out. Guarded by templateId so
 * re-running this (e.g. on every app load) never creates a duplicate for a
 * day that already has one.
 */
export async function ensureRecurringTasksGenerated(daysAhead = 60): Promise<void> {
  const templates = await db.templates.toArray()
  const recurring = templates.filter((t) => !t.archivedAt && t.recurrenceWeekdays.length > 0)
  if (recurring.length === 0) return

  const today = todayKey()
  for (const template of recurring) {
    for (let i = 0; i <= daysAhead; i++) {
      const date = addDays(today, i)
      const weekday = new Date(date + 'T00:00:00').getDay()
      if (!template.recurrenceWeekdays.includes(weekday)) continue

      const day = await getOrCreateDay(date)
      const existing = await db.tasks.where('templateId').equals(template.id).and((t) => t.dayId === day.id).first()
      if (existing) continue

      const now = Date.now()
      await db.tasks.add({
        id: uuid(),
        title: template.title,
        dayId: day.id,
        minutesPerSubtask: template.minutesPerSubtask,
        totalSubtasks: template.totalSubtasks,
        completedSubtasks: 0,
        priority: 'Medium',
        templateId: template.id,
        unit: template.unit,
        customUnitLabel: template.customUnitLabel,
        createdAt: now,
        updatedAt: now,
      })
    }
  }
}
