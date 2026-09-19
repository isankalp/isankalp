import { v4 as uuid } from 'uuid'
import { db } from '../db/db'

/** PU-5: queues a failed webhook call so it can be retried automatically once the app is back online. */
export async function enqueueWebhook(webhookUrl: string, payload: { title: string; totalMinutes: number; completedAt: string }): Promise<void> {
  await db.webhookQueue.add({ id: uuid(), webhookUrl, payload, createdAt: Date.now() })
}

export async function flushWebhookQueue(): Promise<void> {
  const items = await db.webhookQueue.toArray()
  for (const item of items) {
    try {
      const res = await fetch(item.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      })
      if (!res.ok) throw new Error(`Webhook responded with ${res.status}`)
      await db.webhookQueue.delete(item.id)
    } catch {
      // Still offline or the endpoint is still failing — stays queued for the next retry.
    }
  }
}
