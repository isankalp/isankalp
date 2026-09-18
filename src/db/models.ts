export interface Task {
  id: string
  title: string
  dayId: string
  minutesPerSubtask: number
  totalSubtasks: number
  completedSubtasks: number
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

export type DefaultView = 'today' | 'week'
export type Theme = 'light' | 'dark'
export type CompletedBehavior = 'move' | 'in-place'

export interface Settings {
  id: 'settings'
  defaultView: DefaultView
  theme: Theme
  completedBehavior: CompletedBehavior
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultView: 'today',
  theme: 'light',
  completedBehavior: 'move',
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
