import { useRef, useState } from 'react'
import { attachCompletionPhoto } from '../lib/photoEvidence'

/**
 * PP-1/PP-4: an optional prompt shown right after a completedSubtasks increment — the increment has
 * already saved by the time this renders, so skipping or failing here never affects it (PP-5).
 */
export default function PhotoEvidencePrompt({
  taskId,
  completionEventId,
  onDismiss,
  onSaved,
}: {
  taskId: string
  completionEventId: string
  onDismiss: () => void
  /** Called once the photo has actually saved, in addition to onDismiss for an explicit Skip. */
  onSaved?: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'error' | 'saved'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setStatus('saving')
    try {
      await attachCompletionPhoto(taskId, completionEventId, file)
      setStatus('saved')
      onSaved?.()
    } catch {
      setStatus('error')
    }
  }

  if (status === 'saved') {
    return <p className="text-[11px] text-emerald-600 dark:text-emerald-400">📷 Photo saved.</p>
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Add photo evidence"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'saving'}
        className="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : '📷 Add photo evidence'}
      </button>
      {status === 'error' && (
        <span className="text-red-600 dark:text-red-400">
          Failed to save —{' '}
          <button type="button" onClick={() => inputRef.current?.click()} className="underline font-medium">
            Retry
          </button>
        </span>
      )}
      <button type="button" onClick={onDismiss} className="text-slate-400 dark:text-slate-500 underline">
        Skip
      </button>
    </div>
  )
}
