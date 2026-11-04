import { db } from '../db/db'
import type { CustomFieldDef } from '../db/models'

export function isDuplicateFieldName(name: string, existing: CustomFieldDef[], excludeId?: string): boolean {
  const trimmed = name.trim().toLowerCase()
  return existing.some((f) => f.id !== excludeId && f.name.trim().toLowerCase() === trimmed)
}

/** CF-4: deleting a field def never touches task data unless the caller explicitly opts into erasing values too. */
export async function deleteCustomField(fieldId: string, eraseValues: boolean): Promise<void> {
  await db.customFields.delete(fieldId)
  if (!eraseValues) return

  const tasksWithValue = await db.tasks.toArray()
  await db.transaction('rw', db.tasks, async () => {
    for (const task of tasksWithValue) {
      if (!task.customFieldValues || !(fieldId in task.customFieldValues)) continue
      const { [fieldId]: _removed, ...rest } = task.customFieldValues
      await db.tasks.update(task.id, { customFieldValues: rest })
    }
  })
}
