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
  /** Set while this task is in the Blocked state (Epic 79/BK-1). Not editable via the normal
   *  completedSubtasks input while present; cleared by Unblock or by Accept from the carryover queue. */
  blockedAt?: number
  /** Optional free-text note on what it's blocked on (BK-2), set alongside blockedAt. */
  blockedReason?: string
  /** True forever once this task has been Blocked at least once, even after it's Accepted back to
   *  Active — this (not blockedAt) is what drives the carryover queue, so an accepted-but-still-
   *  incomplete task keeps automatically resurfacing on later days without being re-marked Blocked
   *  (RA-3). */
  hasBeenBlocked?: boolean
  /** Set when permanently Rejected from the carryover queue (RA-4). Once set, this task is excluded
   *  from every future carryover queue, though its full history remains viewable (RA-6). */
  blockedRejectedAt?: number
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
  /** "HH:MM" 24h local time this day's tasks are due by (Epic 83/DL-1). Absent = no deadline at
   *  all, and DL-2 requires that absence to mean zero timer/deadline UI anywhere for this day. */
  deadlineTime?: string
  /** Frozen the first time the deadline is observed to have passed (either live, DE-3, or lazily on
   *  a later load, DE-5) by evaluating every non-blocked task's completion at that moment — 'met' if
   *  all were at 100%, otherwise 'missed'. Never recomputed after being set, so a task completed
   *  after the deadline can never flip a recorded 'missed' back to 'met' (DE-5). */
  deadlineOutcome?: 'met' | 'missed'
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
  /** Epic 64/65: distinct Spotify tracks played during the Focus Timer session that produced this
   *  completion (0 if none were). Absent (not 0) means this event didn't come from a Focus Timer
   *  session at all — e.g. a manual +/- — so it's excluded from the with/without-music comparison. */
  spotifyTrackCount?: number
  /** Epic 65: wall-clock minutes that specific Focus Timer session actually took, set alongside
   *  spotifyTrackCount so the two can be compared per-session rather than against a task's
   *  cumulative actualMinutes, which can span several sessions. */
  sessionActualMinutes?: number
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

export const DASHBOARD_WIDGET_IDS = ['goals', 'habits', 'lifestyle'] as const
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
  /** Epic 62: task category label -> Spotify playlist URI, used to auto-select (never auto-play)
   *  a Focus Timer session's playlist based on the task being worked on. */
  focusMusicProfiles: Record<string, string>
  /** Playlist URI used when a task has no category, or its category has no profile above. */
  focusMusicDefaultPlaylist: string
  /** Epic 66: mutes this app's own reminder notifications (Epic 6) while Spotify focus music
   *  started from this app is playing — a real, enforceable "Do Not Disturb" scoped to what a
   *  browser tab can actually control, not a fake OS-level DND toggle. */
  dndDuringFocusMusic: boolean
  /** DR-5: Grid view preferences, restored exactly as last set on the next visit. */
  gridDensity: GridDensity
  /** A GridSection id, or '' for no filter (DR-4). */
  gridSectionFilter: string
  /** The date column the grid was scrolled to when last left, so reopening restores position. */
  gridScrollAnchorDate: string
  /** DI-2: minutes before a day's deadline that the reminder notification fires, when reminders are
   *  enabled and that day has a deadline set. Never fires at all otherwise (DI-3). */
  deadlineReminderLeadMinutes: number
  /** WI-5/WI-6: hours before a weekly plan's To time that its lead-time reminder fires, when
   *  reminders are enabled and the plan still has incomplete non-blocked tasks. */
  weeklyReminderLeadHours: number
}

export type GridDensity = 'compact' | 'comfortable'

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
  focusMusicProfiles: {},
  focusMusicDefaultPlaylist: '',
  dndDuringFocusMusic: true,
  gridDensity: 'comfortable',
  gridSectionFilter: '',
  gridScrollAnchorDate: '',
  deadlineReminderLeadMinutes: 60,
  weeklyReminderLeadHours: 24,
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

// --- Lifestyle Tracking (v12, Epics 68-71) ---

export type LifestyleFieldType = 'boolean' | 'duration' | 'number'

/**
 * A user-defined lifestyle metric and its success threshold (Epic 69). Deleting one (LF-5) sets
 * archivedAt rather than removing the row, so past LifestyleEntry rows that reference it by id
 * stay fully resolvable (name, type, threshold) in a past day's record.
 */
export interface LifestyleField {
  id: string
  name: string
  type: LifestyleFieldType
  order: number
  archivedAt?: number
  createdAt: number
  updatedAt: number
  /** Boolean: LE-3/LF-2 — the value that counts as a pass, plus an optional "count if yes" cap. */
  booleanExpected?: boolean
  booleanCountEnabled?: boolean
  booleanCountMax?: number
  /** Duration: LF-2/LF-3 — either a direct min/max range in minutes, or (if durationAutoCalc) two
   *  labeled time sub-fields the daily entry modal renders instead of a direct duration input. */
  durationAutoCalc?: boolean
  durationStartLabel?: string
  durationEndLabel?: string
  durationMinMinutes?: number
  durationMaxMinutes?: number
  /** Number: LF-2 — a min and/or max limit. */
  numberMin?: number
  numberMax?: number
}

/** One field's logged value for one day (Epic 68). `passed` is evaluated against the field's
 *  threshold at save time and frozen — editing the field's threshold later (LF-4) never
 *  retroactively changes an already-saved entry's pass/fail state. */
export interface LifestyleEntry {
  id: string
  date: string // YYYY-MM-DD
  fieldId: string
  passed: boolean
  updatedAt: number
  // Boolean
  boolValue?: boolean
  countValue?: number
  // Duration — raw inputs kept alongside the calculated value so they can be re-edited (ST-5: the
  // calculated value, not the raw times, is what's evaluated).
  startTime?: string // "HH:MM"
  endTime?: string // "HH:MM"
  sameDay?: boolean // ST-3
  durationMinutes?: number
  // Number
  numberValue?: number
}

// --- Habit/Task Grid (v13, Epics 74-78) ---

/** A collapsible group of rows on the Grid page (Epic 75). Deleting one (SM-3) removes it and
 *  every row/cell under it outright — unlike Lifestyle fields, there's no "keep history" case
 *  called for here, since the PRD is explicit that delete removes checkbox history with it. */
export interface GridSection {
  id: string
  title: string
  order: number
  collapsed: boolean
  createdAt: number
  updatedAt: number
}

/** A single tracked task/habit within a section (Epic 76). */
export interface GridRow {
  id: string
  sectionId: string
  title: string
  order: number
  createdAt: number
  updatedAt: number
}

/** One row's completion mark for one date (Epic 77). Existence = checked; unchecking a cell
 *  deletes the row rather than storing a false flag, keeping the table only as large as what's
 *  actually been checked. Unique per (rowId, date). */
export interface GridCell {
  id: string
  rowId: string
  date: string // YYYY-MM-DD
  createdAt: number
}

// --- Weekly Tasks Module (v17, Epics 92-98) ---

/** A user-defined period (not necessarily 7 days) that owns its own set of tasks, independent of
 *  the daily Task/Day model (WT-8: a weekly task never appears in the daily list or any other
 *  plan). From/To are split date+time, combined via weeklyPlanFromTimestamp/ToTimestamp. */
export interface WeeklyPlan {
  id: string
  /** Optional at creation (WP-4) — weeklyPlanDisplayName() supplies "Week of [From date]" when empty. */
  name: string
  fromDate: string // YYYY-MM-DD
  fromTime: string // HH:MM, 24h local
  toDate: string
  toTime: string
  createdAt: number
  updatedAt: number
  /** Frozen the first time it's observed after the plan ends (WD-11), mirroring Day.deadlineOutcome's
   *  frozen-at-first-observation pattern — never recomputed afterward. */
  deadlineOutcome?: 'met' | 'missed'
}

/** A task that belongs to exactly one WeeklyPlan (WT-8), never a Day. Deliberately the same field
 *  shape as Task wherever one exists (title, minutesPerSubtask, totalSubtasks, completedSubtasks,
 *  priority, notes, subtaskItems, category, unit, customUnitLabel, customFieldValues, the Blocked
 *  fields) so every Pick-typed pure function below that operates on Task also operates on
 *  WeeklyTask unchanged — only planId replaces dayId, and daily-only concerns (dependsOnTaskId,
 *  rolledOverFrom*, actualMinutes, energyRating, googleEventId, scheduledStart/Duration) are omitted
 *  since nothing in this module's PRD calls for them. */
export interface WeeklyTask {
  id: string
  title: string
  planId: string
  minutesPerSubtask: number
  totalSubtasks: number
  completedSubtasks: number
  priority: Priority
  notes?: string
  subtaskItems?: SubtaskItem[]
  category?: TaskCategory
  customFieldValues?: Record<string, string | number>
  unit?: UnitType
  customUnitLabel?: string
  blockedAt?: number
  blockedReason?: string
  hasBeenBlocked?: boolean
  blockedRejectedAt?: number
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

/** Epic 79 (BK-1): a task is Blocked exactly while blockedAt is set. */
export function isTaskBlocked(task: Pick<Task, 'blockedAt'>): boolean {
  return task.blockedAt !== undefined
}

/** The minimal shape the day/plan rollup functions below need — Pick-typed (rather than full Task)
 *  so they also work unchanged on WeeklyTask[] (v17's plan totals, Epic 94), which shares every one
 *  of these fields. */
type AmountTask = Pick<Task, 'blockedAt' | 'minutesPerSubtask' | 'totalSubtasks' | 'completedSubtasks'>

/** BD-2: Blocked tasks' minutes are excluded entirely from day-level totals. */
export function dayMinutesPlanned(tasks: AmountTask[]): number {
  return tasks.filter((t) => !isTaskBlocked(t)).reduce((sum, t) => sum + totalMinutes(t), 0)
}

export function dayMinutesDone(tasks: AmountTask[]): number {
  return tasks.filter((t) => !isTaskBlocked(t)).reduce((sum, t) => sum + minutesDone(t), 0)
}

export function dayPercentComplete(tasks: AmountTask[]): number {
  const planned = dayMinutesPlanned(tasks)
  if (planned <= 0) return 0
  return Math.round((dayMinutesDone(tasks) / planned) * 100)
}

export type DayCompletionState = 'complete' | 'incomplete' | 'none'

/** Epic 72 (TC-1/TC-2/TC-3/TC-5): binary, not gradient — a day is only ever fully green or fully
 *  red, driven purely by whether every task on it is complete, never by timing (a future day with
 *  an unstarted task is incomplete exactly like a past one). Epic 80 (BD-3/BD-4): Blocked tasks
 *  never count toward the "any incomplete = red" rule, and a day left with only Blocked tasks (none
 *  Active/Completed) renders neutral, identical to a day with zero tasks. */
export function dayCompletionState(tasks: AmountTask[]): DayCompletionState {
  const relevant = tasks.filter((t) => !isTaskBlocked(t))
  if (relevant.length === 0) return 'none'
  return relevant.every((t) => isTaskComplete(t)) ? 'complete' : 'incomplete'
}

/** Epic 73 (DP-1/DP-5): unit-agnostic aggregate percent — sums completedSubtasks/totalSubtasks
 *  across every task on the day regardless of unit, distinct from dayPercentComplete's
 *  minutes-weighted number. null (never "0%") for a day with no tasks. Epic 80 (BD-2): Blocked
 *  tasks' totalSubtasks/completedSubtasks are excluded entirely from both sums. Also v17/WG-2/WG-4's
 *  plan percent, which uses the exact same formula. */
export function dayAggregatePercent(tasks: AmountTask[]): number | null {
  const relevant = tasks.filter((t) => !isTaskBlocked(t))
  const totalSum = relevant.reduce((s, t) => s + t.totalSubtasks, 0)
  if (totalSum <= 0) return null
  const doneSum = relevant.reduce((s, t) => s + t.completedSubtasks, 0)
  return Math.round((doneSum / totalSum) * 100)
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

export function sortByPriority<T extends Pick<Task, 'priority' | 'createdAt'>>(tasks: T[]): T[] {
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

export function groupTasksByUnit<T extends Pick<Task, 'unit' | 'customUnitLabel'>>(tasks: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
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

/** CU-4: day/stats rollups are grouped and shown separately per unit, never summed across incompatible
 *  units. Pick-typed via AmountTask & the unit fields so this also works unchanged on WeeklyTask[]
 *  (v17/WG-1's per-unit plan totals). */
export function dayUnitTotals(tasks: (AmountTask & Pick<Task, 'unit' | 'customUnitLabel'>)[]): UnitTotal[] {
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
