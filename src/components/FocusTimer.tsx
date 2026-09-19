import { useEffect, useRef, useState } from 'react'
import type { Task } from '../db/models'
import { AMBIENT_SOUND_OPTIONS, playAmbientSound, stopAmbientSound, type AmbientSoundType } from '../lib/ambientSound'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function FocusTimer({
  task,
  onClose,
  onComplete,
}: {
  task: Task
  onClose: () => void
  onComplete: (actualMinutes: number) => void
}) {
  const totalSeconds = Math.round(task.minutesPerSubtask * 60)
  const [remaining, setRemaining] = useState(totalSeconds)
  const [paused, setPaused] = useState(false)
  const done = remaining <= 0
  const startedAt = useRef(0)
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('none')
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    startedAt.current = Date.now()
    return () => stopAmbientSound()
  }, [])

  useEffect(() => {
    if (done || muted || ambientSound === 'none') {
      stopAmbientSound()
    } else {
      playAmbientSound(ambientSound)
    }
  }, [ambientSound, muted, done])

  useEffect(() => {
    if (paused || done) return
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining, paused, done])

  if (done) {
    return (
      <div className="mt-2 p-3 rounded-md border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 text-center">
        <p className="text-sm font-medium mb-2">Mark 1 subtask complete?</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              onComplete((Date.now() - startedAt.current) / 60000)
              onClose()
            }}
            className="px-3 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            No
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 p-3 rounded-md border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 text-center">
      <p className="text-2xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{formatTime(remaining)}</p>
      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="px-3 py-1 rounded-md border border-indigo-300 dark:border-indigo-600 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px]">
        <span className="text-indigo-600 dark:text-indigo-400">Ambient:</span>
        <select
          value={ambientSound}
          onChange={(e) => setAmbientSound(e.target.value as AmbientSoundType)}
          aria-label="Ambient sound"
          className="px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800"
        >
          {AMBIENT_SOUND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {ambientSound !== 'none' && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute ambient sound' : 'Mute ambient sound'}
            className="px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        )}
      </div>
    </div>
  )
}
