import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { pushUndo } from './undoStack'
import { syncFromSubtaskItems, type SubtaskItem, type Task, type TaskCategory } from '../db/models'

/** BO-2: reassigns every selected task to a different day in one action — none skipped. */
export async function bulkMove(taskIds: string[], targetDate: string): Promise<void> {
  const targetDay = await getOrCreateDay(targetDate)
  const now = Date.now()
  await db.transaction('rw', db.tasks, async () => {
    for (const id of taskIds) {
      await db.tasks.update(id, { dayId: targetDay.id, updatedAt: now })
    }
  })
}

export interface DuplicateResetFields {
  completedSubtasks: number
  totalSubtasks: number
  subtaskItems?: SubtaskItem[]
  rolledOverFromTaskId: undefined
  rolledOverFromTitle: undefined
  actualMinutes: undefined
  energyRating: undefined
  googleEventId: undefined
}

/** BO-3: a duplicated task starts at zero progress, including named subtasks all unchecked, and drops any
 *  per-instance history (rollover origin, Focus Timer actuals, energy rating, calendar sync id). */
export function resetFieldsForDuplicate(task: Task): DuplicateResetFields {
  const subtaskItems = task.subtaskItems?.map((item) => ({ ...item, completed: false }))
  const { totalSubtasks, completedSubtasks } = subtaskItems
    ? syncFromSubtaskItems(subtaskItems)
    : { totalSubtasks: task.totalSubtasks, completedSubtasks: 0 }
  return {
    completedSubtasks,
    totalSubtasks,
    subtaskItems,
    rolledOverFromTaskId: undefined,
    rolledOverFromTitle: undefined,
    actualMinutes: undefined,
    energyRating: undefined,
    googleEventId: undefined,
  }
}

/** BO-3: copies every selected task to a target date; originals are entirely untouched. */
export async function bulkDuplicate(tasks: Task[], targetDate: string): Promise<void> {
  const targetDay = await getOrCreateDay(targetDate)
  const now = Date.now()
  const copies: Task[] = tasks.map((task) => ({
    ...task,
    ...resetFieldsForDuplicate(task),
    id: uuid(),
    dayId: targetDay.id,
    createdAt: now,
    updatedAt: now,
  }))
  await db.tasks.bulkAdd(copies)
}

/** BO-4: applies the same category/tag to every selected task. */
export async function bulkTag(taskIds: string[], category: TaskCategory): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.tasks, async () => {
    for (const id of taskIds) {
      await db.tasks.update(id, { category, updatedAt: now })
    }
  })
}

/** BO-5: the confirmation step itself lives in the UI; this executes once confirmed, and is undoable
 *  in one step like every other destructive action in this app. */
export async function bulkDelete(tasks: Task[]): Promise<void> {
  const ids = tasks.map((t) => t.id)
  await db.tasks.bulkDelete(ids)
  pushUndo({
    description: `Delete ${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
    undo: async () => {
      await db.tasks.bulkAdd(tasks)
    },
  })
}
