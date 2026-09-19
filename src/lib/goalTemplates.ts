export interface GoalTemplate {
  id: string
  title: string
  description: string
  defaultMinutesPerSubtask: number
  defaultTotalSubtasks: number
  /** 0 = Sunday .. 6 = Saturday, for the starter recurring task. */
  recurrenceWeekdays: number[]
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'read-24-books',
    title: 'Read 24 books/year',
    description: 'Two books a month via daily reading.',
    defaultMinutesPerSubtask: 1,
    defaultTotalSubtasks: 20,
    recurrenceWeekdays: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'learn-dsa',
    title: 'Master DSA fundamentals',
    description: 'Daily problem-solving practice.',
    defaultMinutesPerSubtask: 5,
    defaultTotalSubtasks: 5,
    recurrenceWeekdays: [1, 2, 3, 4, 5],
  },
  {
    id: 'fitness-habit',
    title: 'Build a fitness habit',
    description: 'Daily workout reps tracked in minutes.',
    defaultMinutesPerSubtask: 2,
    defaultTotalSubtasks: 15,
    recurrenceWeekdays: [1, 3, 5],
  },
  {
    id: 'learn-language',
    title: 'Learn a new language',
    description: 'Daily vocabulary and practice sessions.',
    defaultMinutesPerSubtask: 10,
    defaultTotalSubtasks: 3,
    recurrenceWeekdays: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'write-daily',
    title: 'Write daily',
    description: 'Journaling or creative writing pages.',
    defaultMinutesPerSubtask: 1,
    defaultTotalSubtasks: 10,
    recurrenceWeekdays: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'meditate',
    title: 'Build a meditation practice',
    description: 'Short daily mindfulness sessions.',
    defaultMinutesPerSubtask: 5,
    defaultTotalSubtasks: 1,
    recurrenceWeekdays: [0, 1, 2, 3, 4, 5, 6],
  },
]

export function searchGoalTemplates(query: string): GoalTemplate[] {
  const q = query.trim().toLowerCase()
  if (!q) return GOAL_TEMPLATES
  return GOAL_TEMPLATES.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
}
