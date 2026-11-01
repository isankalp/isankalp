import { db } from '../db/db'
import type { Day, Settings, Task } from '../db/models'
import { deadlineTimestamp, tasksRemainingCount } from './deadline'
import { todayKey } from './date'

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return notificationSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  return Notification.requestPermission()
}

function alreadyFiredToday(key: string): boolean {
  return localStorage.getItem(key) === todayKey()
}

function markFiredToday(key: string): void {
  localStorage.setItem(key, todayKey())
}

function parseThreshold(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function nowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/** Call periodically (e.g. every 60s) while the app is open. No-ops unless reminders are enabled and permission is granted. */
/** DI-2/DI-3: a lead-time nudge before today's deadline, firing once, only while a deadline is
 *  actually set (an absent deadlineTime means this never fires, independent of remindersEnabled)
 *  and only while non-blocked tasks are still incomplete. */
function checkDeadlineReminder(day: Day | undefined, tasks: Task[], settings: Settings): void {
  if (!day?.deadlineTime) return
  const deadlineAt = deadlineTimestamp(day.date, day.deadlineTime)
  const leadMs = settings.deadlineReminderLeadMinutes * 60 * 1000
  const now = Date.now()
  if (now < deadlineAt - leadMs || now >= deadlineAt) return
  const remaining = tasksRemainingCount(tasks)
  if (remaining === 0) return
  const key = 'reminder:deadline'
  if (alreadyFiredToday(key)) return
  new Notification('Deadline approaching', {
    body: `Due at ${day.deadlineTime} — ${remaining} task${remaining === 1 ? '' : 's'} remaining.`,
  })
  markFiredToday(key)
}

export async function checkReminders(settings: Settings): Promise<void> {
  if (!settings.remindersEnabled || notificationPermission() !== 'granted') return

  const today = todayKey()
  const nowMin = nowMinutes()
  const day = await db.days.where('date').equals(today).first()
  const tasks = day ? await db.tasks.where('dayId').equals(day.id).toArray() : []

  checkDeadlineReminder(day, tasks, settings)

  if (tasks.length === 0) {
    if (nowMin >= parseThreshold(settings.eveningNudgeTime) && !alreadyFiredToday('reminder:empty-day')) {
      new Notification('Plan your day', { body: "You haven't added any tasks for today yet." })
      markFiredToday('reminder:empty-day')
    }
    return
  }

  if (nowMin < parseThreshold(settings.notStartedThreshold)) return
  for (const task of tasks) {
    if (task.completedSubtasks > 0) continue
    const key = `reminder:not-started:${task.id}`
    if (alreadyFiredToday(key)) continue
    new Notification('Task not started', { body: task.title })
    markFiredToday(key)
  }
}
