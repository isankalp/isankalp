import { db } from '../db/db'
import { addDays, todayKey } from './date'

export interface PlanSuggestion {
  /** `${goalId}:${taskTitle}` — stable client key. */
  id: string
  goalId: string
  goalTitle: string
  taskTitle: string
  minutesPerSubtask: number
  totalSubtasks: number
}

/** Suggests one task per goal-linked title, sized from that title's average pace over the last 4 weeks. */
export async function buildWeeklySuggestions(): Promise<PlanSuggestion[]> {
  const goals = (await db.goals.toArray()).filter((g) => !g.archivedAt)
  if (goals.length === 0) return []

  const cutoff = addDays(todayKey(), -28)
  const [days, allTasks] = await Promise.all([db.days.toArray(), db.tasks.toArray()])
  const dayDateById = new Map(days.map((d) => [d.id, d.date]))

  const suggestions: PlanSuggestion[] = []
  const seen = new Set<string>()
  for (const goal of goals) {
    for (const title of goal.linkedTaskTitles) {
      if (seen.has(title)) continue
      const recent = allTasks.filter((t) => {
        if (t.title !== title) return false
        const date = dayDateById.get(t.dayId)
        return date !== undefined && date >= cutoff
      })
      if (recent.length === 0) continue
      seen.add(title)
      const avgMinutes = recent.reduce((s, t) => s + t.minutesPerSubtask, 0) / recent.length
      const avgTotal = recent.reduce((s, t) => s + t.totalSubtasks, 0) / recent.length
      suggestions.push({
        id: `${goal.id}:${title}`,
        goalId: goal.id,
        goalTitle: goal.title,
        taskTitle: title,
        minutesPerSubtask: Math.round(avgMinutes * 10) / 10,
        totalSubtasks: Math.max(1, Math.round(avgTotal)),
      })
    }
  }
  return suggestions
}

const PROMPT_KEY = 'goals-tracker:planWizardLastPromptWeek'

export function shouldPromptWeeklyPlan(currentWeekStart: string): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) !== currentWeekStart
  } catch {
    return false
  }
}

export function markWeeklyPlanPrompted(currentWeekStart: string): void {
  try {
    localStorage.setItem(PROMPT_KEY, currentWeekStart)
  } catch {
    // localStorage unavailable — non-fatal, prompt may reappear next load
  }
}
