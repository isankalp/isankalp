import { db } from '../db/db'
import type { Day, Settings, Task, WeeklyPlan, WeeklyTask } from '../db/models'
import { deadlineTimestamp, tasksRemainingCount } from './deadline'
import { todayKey } from './date'
import { weeklyPlanDisplayName, weeklyPlanState, weeklyPlanToTimestamp } from './weekly'

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

/** WI-5: a plan's lead-time reminder fires at most once ever (not once per calendar day — its lead
 *  window can straddle midnight), so this dedup is never date-scoped like the daily ones above. */
function alreadyFired(key: string): boolean {
  return localStorage.getItem(key) === 'fired'
}

function markFired(key: string): void {
  localStorage.setItem(key, 'fired')
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

/** WI-5/WI-6: a lead-time nudge before an Active plan's To moment, firing at most once per plan,
 *  only while it still has non-blocked tasks below 100%. Never fires for an Upcoming or Ended plan,
 *  or once every non-blocked task is already done. */
function checkWeeklyPlanReminders(plans: WeeklyPlan[], tasksByPlanId: Map<string, WeeklyTask[]>, settings: Settings): void {
  const now = Date.now()
  for (const plan of plans) {
    if (weeklyPlanState(plan, now) !== 'active') continue
    const toAt = weeklyPlanToTimestamp(plan)
    const leadMs = settings.weeklyReminderLeadHours * 60 * 60 * 1000
    if (now < toAt - leadMs) continue
    const remaining = tasksRemainingCount(tasksByPlanId.get(plan.id) ?? [])
    if (remaining === 0) continue
    const key = `reminder:weekly:${plan.id}`
    if (alreadyFired(key)) continue
    new Notification('Weekly plan deadline approaching', {
      body: `"${weeklyPlanDisplayName(plan)}" due ${plan.toDate} ${plan.toTime} — ${remaining} task${remaining === 1 ? '' : 's'} remaining.`,
    })
    markFired(key)
  }
}

export async function checkReminders(settings: Settings): Promise<void> {
  if (!settings.remindersEnabled || notificationPermission() !== 'granted') return

  const today = todayKey()
  const nowMin = nowMinutes()
  const day = await db.days.where('date').equals(today).first()
  const tasks = day ? await db.tasks.where('dayId').equals(day.id).toArray() : []

  checkDeadlineReminder(day, tasks, settings)

  const weeklyPlans = await db.weeklyPlans.toArray()
  if (weeklyPlans.length > 0) {
    const weeklyTasks = await db.weeklyTasks.toArray()
    const tasksByPlanId = new Map<string, WeeklyTask[]>()
    for (const task of weeklyTasks) {
      const list = tasksByPlanId.get(task.planId) ?? []
      list.push(task)
      tasksByPlanId.set(task.planId, list)
    }
    checkWeeklyPlanReminders(weeklyPlans, tasksByPlanId, settings)
  }

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
