import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { parseQuickAdd, type ParsedQuickAdd } from '../lib/quickAddParser'
import { recognizeSpeech, speechRecognitionSupported } from '../lib/speechInput'

export interface QuickAddPrefill {
  title: string
  minutesPerSubtask?: number
  totalSubtasks?: number
}

export default function QuickAddBar({ date, onManualFallback }: { date: string; onManualFallback: (prefill: QuickAddPrefill) => void }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedQuickAdd | null>(null)
  const [parseFailed, setParseFailed] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  function handleChange(value: string) {
    setText(value)
    setVoiceError(null)
    if (!value.trim()) {
      setParsed(null)
      setParseFailed(false)
      return
    }
    const result = parseQuickAdd(value)
    if (result.success && result.parsed) {
      setParsed(result.parsed)
      setParseFailed(false)
    } else {
      setParsed(null)
      setParseFailed(true)
    }
  }

  async function handleMic() {
    if (!speechRecognitionSupported()) {
      setVoiceError('Voice input is not supported in this browser.')
      return
    }
    setListening(true)
    setVoiceError(null)
    try {
      const transcript = await recognizeSpeech()
      handleChange(transcript)
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Didn't catch that — try again or type instead")
    } finally {
      setListening(false)
    }
  }

  async function confirmCreate() {
    if (!parsed) return
    const day = await getOrCreateDay(date)
    const now = Date.now()
    await db.tasks.add({
      id: uuid(),
      title: parsed.title,
      dayId: day.id,
      minutesPerSubtask: parsed.minutesPerSubtask,
      totalSubtasks: parsed.totalSubtasks,
      completedSubtasks: 0,
      priority: 'Medium',
      createdAt: now,
      updatedAt: now,
    })
    setText('')
    setParsed(null)
    setParseFailed(false)
  }

  function useManualFallback() {
    const result = parseQuickAdd(text)
    onManualFallback(result.recognized)
    setText('')
    setParsed(null)
    setParseFailed(false)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <input
          type="text"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder='Quick add: "50 pages reading, 1 min each"'
          aria-label="Quick add task"
          className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent focus:outline-none"
        />
        {speechRecognitionSupported() && (
          <button
            type="button"
            onClick={handleMic}
            aria-label="Add by voice"
            aria-pressed={listening}
            className={`text-sm px-1.5 py-1 rounded-md ${listening ? 'animate-pulse text-red-500' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
          >
            🎤
          </button>
        )}
      </div>

      {parsed && (
        <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs p-2 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-700">
          <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700">{parsed.title}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700">
            {parsed.minutesPerSubtask} min/subtask
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700">
            {parsed.totalSubtasks} subtasks
          </span>
          <button type="button" onClick={confirmCreate} className="ml-auto px-2.5 py-1 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
            Confirm &amp; Add
          </button>
          <button
            type="button"
            onClick={useManualFallback}
            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Edit manually
          </button>
        </div>
      )}

      {parseFailed && (
        <div className="mt-1.5 flex items-center gap-2 text-xs p-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300">
          <span>Couldn&rsquo;t parse that —</span>
          <button type="button" onClick={useManualFallback} className="underline font-medium">
            fill in manually
          </button>
        </div>
      )}

      {voiceError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{voiceError}</p>}
    </div>
  )
}
