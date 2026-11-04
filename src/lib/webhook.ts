import type { Task } from '../db/models'
import { totalMinutes } from '../db/models'

export function isValidWebhookUrl(value: string): boolean {
  if (!value) return true // empty = not configured, not an error
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** IE-5/6: fires a completion webhook; throws on failure so the caller can surface a retry toast. */
export async function fireCompletionWebhook(webhookUrl: string, task: Task): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: task.title,
      totalMinutes: totalMinutes(task),
      completedAt: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`Webhook responded with ${res.status}`)
}
