export type Priority = 'High' | 'Medium' | 'Low'

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']

export type UnitType = 'minutes' | 'pages' | 'reps' | 'dollars' | 'custom'

export const UNIT_TYPES: UnitType[] = ['minutes', 'pages', 'reps', 'dollars', 'custom']

const UNIT_DEFAULT_LABELS: Record<UnitType, string> = {
  minutes: 'min',
  pages: 'pages',
  reps: 'reps',
  dollars: '$',
  custom: 'units',
}

export interface SubtaskItem {
  id: string
  title: string
  completed: boolean
}

export interface TaskCategory {
  label: string
  color: string
  icon: string
}

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
  /** Named checklist mode (Epic 11). When present, totalSubtasks/completedSubtasks are kept in sync from this list. */
  subtaskItems?: SubtaskItem[]
  /** Another task's id that must reach 100% before this task's progress can be edited (Epic 9). */
  dependsOnTaskId?: string
  /** Set when this task was created by rolling forward yesterday's unfinished subtasks (Epic 9). */
  rolledOverFromTaskId?: string
  rolledOverFromTitle?: string
  /** Cumulative actual minutes spent in Focus Timer sessions, vs. planned totalMinutes (Epic 10). */
  actualMinutes?: number
  /** 1-5 energy rating optionally logged when the task reaches 100% (Epic 10). */
  energyRating?: number
  category?: TaskCategory
  /** Google Calendar event id this task was last synced to, for update-in-place dedup (Epic 13). */
  googleEventId?: string
  /** Values keyed by CustomFieldDef id (Epic 19). Kept even after the field def is deleted, unless erased explicitly. */
  customFieldValues?: Record<string, string | number>
  /** Measurement unit for this task's amounts (Epic 32). Absent/legacy tasks are treated as 'minutes' — see unitOf(). */
  unit?: UnitType
  /** User-defined label, only meaningful when unit === 'custom'. */
  customUnitLabel?: string
  /** "HH:MM" 24h local time this task is scheduled to start in the Time-Blocking view (Epic 44). Absent = unscheduled. */
  scheduledStart?: string
  /** Block duration shown on the Time-Blocking grid, independent of the task's own subtask math (Epic 44). */
  scheduledDurationMinutes?: number
  createdAt: number
  updatedAt: number
}

export type CustomFieldType = 'text' | 'number' | 'dropdown'

export interface CustomFieldDef {
  id: string
  name: string
  type: CustomFieldType
  /** Only for type 'dropdown'. */
  options?: string[]
  createdAt: number
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
  /** Soft-archive: hidden from the active Goals list, excluded from active progress, but keeps full history. */
  archivedAt?: number
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
  /** Carried onto every task generated from this template (Epic 32). Absent means 'minutes'. */
  unit?: UnitType
  customUnitLabel?: string
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

export interface CompletionEvent {
  id: string
  taskId: string
  /** Change in completedSubtasks (usually +1, can be negative for an undo). */
  delta: number
  at: number
}

export interface VoiceNote {
  id: string
  taskId: string
  blob: Blob
  createdAt: number
}

/** A snapshot of a task's fields immediately before a mutation, for Epic 20's version history + restore. */
export interface TaskHistoryEntry {
  id: string
  taskId: string
  /** The fields that changed, with their PREVIOUS values. */
  previousValues: Partial<Task>
  at: number
}

/** A completion webhook call that failed while offline (or otherwise), retried automatically once back online (PU-5). */
export interface WebhookQueueItem {
  id: string
  webhookUrl: string
  payload: { title: string; totalMinutes: number; completedAt: string }
  createdAt: number
}

/** A photo attached to one specific completion event (Epic 41). Never required for the increment itself to save. */
export interface CompletionPhoto {
  id: string
  taskId: string
  completionEventId: string
  blob: Blob
  mimeType: string
  createdAt: number
}

export type DefaultView = 'dashboard' | 'today' | 'week'

export const DASHBOARD_WIDGET_IDS = ['goals', 'habits'] as const
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number]
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
  webhookUrl: string
  googleCalendarConnected: boolean
  /** Domains the user wants blocked during a Focus Timer session (Epic 17). Stored only — enforcement needs a
   *  companion browser extension that isn't part of this app, so the list has no runtime effect on its own. */
  focusBlocklist: string[]
  highContrast: boolean
  autoBackupEnabled: boolean
  autoBackupIntervalDays: number
  lastAutoBackupAt?: number
  lastAutoBackupFailedAt?: number
  /** UI language (Epic 38). User-generated content is never translated, only static UI strings. */
  language: Locale
  /** CP-5: capacity is fully opt-in — 'off' means no overcommitment warnings ever appear. */
  capacityMode: CapacityMode
  /** Minutes budget for the chosen mode (per day, or per week). Ignored while capacityMode is 'off'. */
  capacityMinutes: number
  /** BYOK Claude API key (Epic 58, AK-1). Every AI feature is gated on this being set — see aiConfigured(). */
  aiApiKey?: string
  /** Self-tracked count of AI requests made since aiRequestCountSince (AK-5) — this app's own count, not a
   *  verified read of Anthropic's actual billing dashboard, since there's no browser-safe API for that. */
  aiRequestCount: number
  aiRequestCountSince: number
  /** JC-5: independent of the API key being set — lets journal content stay excluded even with AI otherwise on. */
  journalAnalysisEnabled: boolean
  /** QC-5/QC-6: gates whether new tasks get AI tag suggestions at all; the suggestions themselves are
   *  always editable/removable before save regardless of this setting. */
  autoTaggingEnabled: boolean
  /** DB-7: Dashboard widget order and visibility, persisted per account/device like every other setting. */
  dashboardWidgetOrder: DashboardWidgetId[]
  dashboardHiddenWidgets: DashboardWidgetId[]
}

export type CapacityMode = 'off' | 'daily' | 'weekly'

export type Locale = 'en' | 'es' | 'hi'

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'hi', label: 'हिन्दी' },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultView: 'dashboard',
  theme: 'light',
  completedBehavior: 'move',
  remindersEnabled: false,
  notStartedThreshold: '12:00',
  eveningNudgeTime: '19:00',
  webhookUrl: '',
  googleCalendarConnected: false,
  focusBlocklist: [],
  highContrast: false,
  autoBackupEnabled: false,
  autoBackupIntervalDays: 1,
  language: 'en',
  capacityMode: 'off',
  capacityMinutes: 0,
  aiRequestCount: 0,
  aiRequestCountSince: Date.now(),
  journalAnalysisEnabled: true,
  autoTaggingEnabled: true,
  dashboardWidgetOrder: [...DASHBOARD_WIDGET_IDS],
  dashboardHiddenWidgets: [],
}

/** A single free-text daily journal entry (Epic 57's prerequisite — never built as its own "v5"
 *  epic in this app, so it's introduced here as the minimal real feature Journal Coaching needs). */
export interface JournalEntry {
  id: string
  date: string // YYYY-MM-DD
  text: string
  createdAt: number
  updatedAt: number
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

/** Recompute {totalSubtasks, completedSubtasks} from a named subtask list, keeping numeric math untouched. */
export function syncFromSubtaskItems(items: SubtaskItem[]): { totalSubtasks: number; completedSubtasks: number } {
  return { totalSubtasks: items.length, completedSubtasks: items.filter((i) => i.completed).length }
}

/** GL-5: a named-subtask task must have at least one item to be saved. */
export function isSubtaskItemsValid(useNamedSubtasks: boolean, items: SubtaskItem[]): boolean {
  return !useNamedSubtasks || items.length > 0
}

/** SP-5/6: a task is locked while its dependency (if any) hasn't reached 100% yet. */
export function isTaskLocked(task: Pick<Task, 'dependsOnTaskId'>, tasksById: Map<string, Task>): boolean {
  if (!task.dependsOnTaskId) return false
  const dependency = tasksById.get(task.dependsOnTaskId)
  if (!dependency) return false
  return !isTaskComplete(dependency)
}

/** CU-5: legacy tasks with no unit set are treated as Minutes, with zero migration/re-entry needed. */
export function unitOf(task: Pick<Task, 'unit'>): UnitType {
  return task.unit ?? 'minutes'
}

/** Display label for a task's amounts, e.g. "min", "pages", or the user's own custom label. */
export function unitLabel(task: Pick<Task, 'unit' | 'customUnitLabel'>): string {
  const unit = unitOf(task)
  if (unit === 'custom') return task.customUnitLabel?.trim() || UNIT_DEFAULT_LABELS.custom
  return UNIT_DEFAULT_LABELS[unit]
}

/** Grouping key so two custom units with different labels (e.g. "calories" vs "dollars saved") never merge. */
export function unitKey(task: Pick<Task, 'unit' | 'customUnitLabel'>): string {
  const unit = unitOf(task)
  return unit === 'custom' ? `custom:${task.customUnitLabel?.trim().toLowerCase() || 'units'}` : unit
}

/** CU-2: a custom unit must have a non-empty label before the task can be saved. */
export function isCustomUnitValid(unit: UnitType, customUnitLabel: string): boolean {
  return unit !== 'custom' || customUnitLabel.trim().length > 0
}

export function groupTasksByUnit(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = unitKey(task)
    const list = map.get(key) ?? []
    list.push(task)
    map.set(key, list)
  }
  return map
}

export interface UnitTotal {
  key: string
  label: string
  planned: number
  done: number
  percent: number
}

/** CU-4: day/stats rollups are grouped and shown separately per unit, never summed across incompatible units. */
export function dayUnitTotals(tasks: Task[]): UnitTotal[] {
  const groups = groupTasksByUnit(tasks)
  return [...groups.entries()]
    .map(([key, groupTasks]) => ({
      key,
      label: unitLabel(groupTasks[0]),
      planned: dayMinutesPlanned(groupTasks),
      done: dayMinutesDone(groupTasks),
      percent: dayPercentComplete(groupTasks),
    }))
    .sort((a, b) => (a.key === 'minutes' ? -1 : b.key === 'minutes' ? 1 : a.label.localeCompare(b.label)))
}
