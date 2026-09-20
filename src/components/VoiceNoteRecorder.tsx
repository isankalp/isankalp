import { useLiveQuery } from '../hooks/useLiveQuery'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'

function recordingSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined'
}

function VoiceNoteItem({ blob, onDelete }: { blob: Blob; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  if (!url) return null
  return (
    <div className="flex items-center gap-1.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls src={url} className="h-8 flex-1" />
      <button type="button" onClick={onDelete} aria-label="Delete voice note" className="text-slate-400 hover:text-red-600 text-xs">
        ✕
      </button>
    </div>
  )
}

export default function VoiceNoteRecorder({ taskId }: { taskId: string }) {
  const notes = useLiveQuery(() => db.voiceNotes.where('taskId').equals(taskId).toArray(), [taskId]) ?? []
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [error, setError] = useState<string | null>(null)

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        await db.voiceNotes.add({ id: uuid(), taskId, blob, createdAt: Date.now() })
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Microphone access denied or unavailable.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  async function deleteNote(id: string) {
    await db.voiceNotes.delete(id)
  }

  if (!recordingSupported()) return null

  return (
    <div className="mt-2 space-y-1.5">
      {notes.map((n) => (
        <VoiceNoteItem key={n.id} blob={n.blob} onDelete={() => deleteNote(n.id)} />
      ))}
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        className={`text-[11px] px-2 py-1 rounded-md border ${
          recording
            ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
            : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        {recording ? '⏹ Stop Recording' : '🎙 Record Note'}
      </button>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
