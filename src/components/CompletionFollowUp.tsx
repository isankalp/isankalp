import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { totalMinutes, type Task } from '../db/models'
import { useSettings } from '../context/SettingsContext'
import { fireCompletionWebhook } from '../lib/webhook'
import { enqueueWebhook } from '../lib/webhookQueue'
import PhotoEvidencePrompt from './PhotoEvidencePrompt'

/**
 * Rendered at the page level (not inside TaskRow) because a task reaching 100% often moves to the
 * Completed section, unmounting its row before the user could see this prompt.
 */
export default function CompletionFollowUp({
  task,
  completionEventId,
  onDone,
}: {
  task: Task
  /** The specific completion event this 100% transition created, for photo evidence (PP-1). Null if none logged. */
  completionEventId: string | null
  onDone: () => void
}) {
  const { settings } = useSettings()
  const [webhookError, setWebhookError] = useState(false)
  const [photoDismissed, setPhotoDismissed] = useState(false)

  function sendWebhook() {
    if (!settings.webhookUrl) return
    fireCompletionWebhook(settings.webhookUrl, task)
      .then(() => setWebhookError(false))
      .catch(() => {
        setWebhookError(true)
        // PU-5: also queued so it retries automatically once the app is back online, even if the user navigates away.
        enqueueWebhook(settings.webhookUrl, {
          title: task.title,
          totalMinutes: totalMinutes(task),
          completedAt: new Date().toISOString(),
        })
      })
  }

  // Intentionally scoped to task.id only — fires once for this specific completed task instance,
  // not on every settings change while the follow-up banner happens to still be showing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(sendWebhook, [task.id])

  const [energyDone, setEnergyDone] = useState(false)
  const photoResolved = !completionEventId || photoDismissed

  useEffect(() => {
    if (energyDone && photoResolved) onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone is stable per mount; re-running on identity change would re-fire it
  }, [energyDone, photoResolved])

  async function commitEnergy(rating: number | null) {
    if (rating !== null) await db.tasks.update(task.id, { energyRating: rating })
    setEnergyDone(true)
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 flex items-center gap-2 flex-wrap text-xs">
        <span>&ldquo;{task.title}&rdquo; complete! Energy while doing this? (optional)</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => commitEnergy(n)}
            className="w-6 h-6 rounded-full border border-emerald-300 dark:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
          >
            {n}
          </button>
        ))}
        <button type="button" onClick={() => commitEnergy(null)} className="underline text-slate-500 dark:text-slate-400">
          Skip
        </button>
      </div>
      {completionEventId && !photoDismissed && (
        <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10">
          <PhotoEvidencePrompt
            taskId={task.id}
            completionEventId={completionEventId}
            onDismiss={() => setPhotoDismissed(true)}
            onSaved={() => setPhotoDismissed(true)}
          />
        </div>
      )}
      {webhookError && (
        <div className="p-2 rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-500/10 text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between gap-2">
          <span>Webhook failed to send for &ldquo;{task.title}&rdquo;.</span>
          <button type="button" onClick={sendWebhook} className="underline font-medium">
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
