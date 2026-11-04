import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { CompletionPhoto } from '../db/models'

/**
 * PP-4/PP-5: called only after a completedSubtasks increment has already saved successfully.
 * A failure here never rolls back or affects that increment — only this attachment fails, with a retry.
 */
export async function attachCompletionPhoto(taskId: string, completionEventId: string, file: Blob): Promise<void> {
  await db.completionPhotos.add({
    id: uuid(),
    taskId,
    completionEventId,
    blob: file,
    mimeType: file.type,
    createdAt: Date.now(),
  })
}

/** PP-2: chronological order, oldest first, alongside their completion timestamps. */
export async function photosForTask(taskId: string): Promise<CompletionPhoto[]> {
  const photos = await db.completionPhotos.where('taskId').equals(taskId).toArray()
  return photos.sort((a, b) => a.createdAt - b.createdAt)
}
