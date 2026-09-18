export type Priority = 'High' | 'Medium' | 'Low'

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']

export interface Task {
  id: string
  title: string
  dayId: string
  minutesPerSubtask: number
  totalSubtasks: number
  completedSubtasks: number
  priority: Priority
  notes?: string
  templateId?: string
  createdAt: number
  updatedAt: number
}

export interface Day {
  id: string
  date: string // YYYY-MM-DD
}

export interface Goal {
  id: string
  title: string
  linkedTaskTitles: string[]
  targetDate?: string
}

export interface Habit {
  id: string
  title: string
  createdAt: number
  /** Soft-delete: hides the habit from future days while preserving its log history. */
  archivedAt?: number
}

export interface HabitLog {
  id: string
  habitId: string
  date: string // YYYY-MM-DD
  completedAt: number
}

export interface Template {
  id: string
  title: string
  minutesPerSubtask: number
  totalSubtasks: number
  /** 0 = Sunday .. 6 = Saturday. Empty means no auto-recurrence. */
  recurrenceWeekdays: number[]
  createdAt: number
  /** Soft-delete: stops future recurrence; already-created tasks are unaffected. */
  archivedAt?: number
}

export type ReviewPeriodType = 'week' | 'month'

export interface Review {
  /** `${periodType}:${periodKey}` — deterministic so re-saving a reflection overwrites in place. */
  id: string
  periodType: ReviewPeriodType
  periodKey: string
  reflection: string
  updatedAt: number
}

export type BadgeType = 'streak' | 'minutes'

export interface Badge {
  /** `${type}-${milestone}` — deterministic so a milestone is only ever awarded once. */
  id: string
  type: BadgeType
  milestone: number
  earnedAt: number
  notifiedAt?: number
}

export type DefaultView = 'today' | 'week'
export type Theme = 'light' | 'dark'
export type CompletedBehavior = 'move' | 'in-place'

export interface Settings {
  id: 'settings'
  defaultView: DefaultView
  theme: Theme
  completedBehavior: CompletedBehavior
  remindersEnabled: boolean
  notStartedThreshold: string // "HH:MM", 24h local time
  eveningNudgeTime: string // "HH:MM", 24h local time
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultView: 'today',
  theme: 'light',
  completedBehavior: 'move',
  remindersEnabled: false,
  notStartedThreshold: '12:00',
  eveningNudgeTime: '19:00',
}

/** Clamp completedSubtasks into [0, totalSubtasks], rounding to whole units. */
export function clampCompleted(completed: number, totalSubtasks: number): number {
  const total = Math.max(0, Math.floor(totalSubtasks) || 0)
  if (!Number.isFinite(completed)) return 0
  return Math.min(Math.max(Math.round(completed), 0), total)
}

export function totalMinutes(task: Pick<Task, 'minutesPerSubtask' | 'totalSubtasks'>): number {
  return task.minutesPerSubtask * task.totalSubtasks
}

export function minutesDone(task: Pick<Task, 'minutesPerSubtask' | 'completedSubtasks'>): number {
  return task.minutesPerSubtask * task.completedSubtasks
}

export function percentComplete(task: Pick<Task, 'totalSubtasks' | 'completedSubtasks'>): number {
  if (task.totalSubtasks <= 0) return 0
  return Math.round((task.completedSubtasks / task.totalSubtasks) * 100)
}

export function isTaskComplete(task: Pick<Task, 'totalSubtasks' | 'completedSubtasks'>): boolean {
  return task.totalSubtasks > 0 && task.completedSubtasks === task.totalSubtasks
}

export function dayMinutesPlanned(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + totalMinutes(t), 0)
}

export function dayMinutesDone(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + minutesDone(t), 0)
}

export function dayPercentComplete(tasks: Task[]): number {
  const planned = dayMinutesPlanned(tasks)
  if (planned <= 0) return 0
  return Math.round((dayMinutesDone(tasks) / planned) * 100)
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    return rank !== 0 ? rank : a.createdAt - b.createdAt
  })
}
