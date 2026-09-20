import { useEffect, useRef, useState } from 'react'
import type { Task } from '../db/models'
import { AMBIENT_SOUND_OPTIONS, playAmbientSound, stopAmbientSound, type AmbientSoundType } from '../lib/ambientSound'
import { useSpotifyPlayer } from '../context/SpotifyPlayerContext'
import { fetchUserPlaylists, type SpotifyPlaylist } from '../lib/spotifyPlayback'
import { useSettings } from '../context/SettingsContext'

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

  const spotify = useSpotifyPlayer()
  const { settings } = useSettings()
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [selectedPlaylistUri, setSelectedPlaylistUri] = useState('')
  const [spotifyStarting, setSpotifyStarting] = useState(false)

  // Epic 62: pre-select this task's category profile (falling back to the account-wide default),
  // never auto-playing — the user still has to hit Play, same as choosing any other playlist here.
  useEffect(() => {
    if (!spotify.connected) return
    fetchUserPlaylists().then((result) => {
      if (result.ok && result.data.length > 0) {
        setPlaylists(result.data)
        const categoryLabel = task.category?.label
        const preferred =
          (categoryLabel && settings.focusMusicProfiles[categoryLabel]) || settings.focusMusicDefaultPlaylist
        const preferredIsValid = preferred && result.data.some((p) => p.uri === preferred)
        setSelectedPlaylistUri((prev) => prev || (preferredIsValid ? preferred : result.data[0].uri))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per session, not on every spotify context change
  }, [spotify.connected])

  async function handlePlayFocusMusic() {
    if (!selectedPlaylistUri) return
    setSpotifyStarting(true)
    await spotify.playContext(selectedPlaylistUri)
    setSpotifyStarting(false)
  }

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
      {spotify.connected && playlists.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] flex-wrap">
          <span className="text-indigo-600 dark:text-indigo-400">🎵 Focus music:</span>
          <select
            value={selectedPlaylistUri}
            onChange={(e) => setSelectedPlaylistUri(e.target.value)}
            aria-label="Focus music playlist"
            className="px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 max-w-[10rem]"
          >
            {playlists.map((p) => (
              <option key={p.id} value={p.uri}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePlayFocusMusic}
            disabled={spotifyStarting}
            className="px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {spotifyStarting ? '…' : spotify.isPlaying ? 'Playing' : 'Play'}
          </button>
        </div>
      )}
      {spotify.error && <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{spotify.error}</p>}
    </div>
  )
}
