import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { isTaskComplete, type Task } from '../db/models'
import { addDays, todayKey } from './date'

const DISMISSED_KEY = 'goals-tracker:rollover-dismissed'

function dismissedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function markDismissed(taskId: string): void {
  const ids = dismissedIds()
  ids.add(taskId)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

export interface RolloverCandidate {
  task: Task
  remaining: number
}

/** Yesterday's unfinished tasks, excluding ones already rolled over (accepted) or dismissed (declined). Only relevant when viewing today. */
export async function getRolloverCandidates(viewedDate: string): Promise<RolloverCandidate[]> {
  if (viewedDate !== todayKey()) return []
  const yesterday = addDays(viewedDate, -1)
  const yDay = await db.days.where('date').equals(yesterday).first()
  if (!yDay) return []
  const yTasks = await db.tasks.where('dayId').equals(yDay.id).toArray()

  const todayDay = await db.days.where('date').equals(viewedDate).first()
  const todayTasks = todayDay ? await db.tasks.where('dayId').equals(todayDay.id).toArray() : []
  const alreadyRolled = new Set(todayTasks.map((t) => t.rolledOverFromTaskId).filter((id): id is string => Boolean(id)))
  const dismissed = dismissedIds()

  return yTasks
    .filter((t) => !isTaskComplete(t) && !alreadyRolled.has(t.id) && !dismissed.has(t.id))
    .map((task) => ({ task, remaining: task.totalSubtasks - task.completedSubtasks }))
}

export async function acceptRollover(candidate: RolloverCandidate, targetDate: string): Promise<void> {
  const day = await getOrCreateDay(targetDate)
  const now = Date.now()
  await db.tasks.add({
    id: uuid(),
    title: candidate.task.title,
    dayId: day.id,
    minutesPerSubtask: candidate.task.minutesPerSubtask,
    totalSubtasks: candidate.remaining,
    completedSubtasks: 0,
    priority: candidate.task.priority,
    rolledOverFromTaskId: candidate.task.id,
    rolledOverFromTitle: candidate.task.title,
    createdAt: now,
    updatedAt: now,
  })
  markDismissed(candidate.task.id)
}

export function declineRollover(candidate: RolloverCandidate): void {
  markDismissed(candidate.task.id)
}
