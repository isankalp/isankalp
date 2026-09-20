import { useEffect, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { useSettings } from '../context/SettingsContext'
import { useSpotifyPlayer } from '../context/SpotifyPlayerContext'
import { fetchUserPlaylists, type SpotifyPlaylist } from '../lib/spotifyPlayback'

// Epic 62: maps a task's category to a Spotify playlist, so Focus Timer can pre-select (never
// auto-play) the right music for the kind of work being done, instead of always defaulting to
// whichever playlist happened to load first.
export default function SpotifyFocusMusicSettings() {
  const { connected } = useSpotifyPlayer()
  const { settings, updateSettings } = useSettings()
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [error, setError] = useState<string | null>(null)

  const categorizedTasks = useLiveQuery(() => db.tasks.filter((t) => !!t.category).toArray(), []) ?? []
  const categoryLabels = Array.from(new Set(categorizedTasks.map((t) => t.category!.label))).sort()

  useEffect(() => {
    if (!connected) return
    fetchUserPlaylists().then((result) => {
      if (result.ok) setPlaylists(result.data)
      else setError(result.error)
    })
  }, [connected])

  if (!connected) return null

  function setProfile(label: string, uri: string) {
    const next = { ...settings.focusMusicProfiles }
    if (uri) next[label] = uri
    else delete next[label]
    updateSettings({ focusMusicProfiles: next })
  }

  return (
    <>
      <h2 className="text-lg font-bold mt-6 mb-3">Focus Music</h2>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
        {error && <p className="text-xs text-red-600 dark:text-red-400 py-2">{error}</p>}
        {playlists.length === 0 && !error ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">Loading your playlists…</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
              <div>
                <p className="font-medium text-sm">Default</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Used for tasks with no category, or no profile below.</p>
              </div>
              <select
                value={settings.focusMusicDefaultPlaylist}
                onChange={(e) => updateSettings({ focusMusicDefaultPlaylist: e.target.value })}
                aria-label="Default focus music playlist"
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs max-w-[10rem]"
              >
                <option value="">— none —</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.uri}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {categoryLabels.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                Tag a task with a category (its row's 🏷️ button) to set a playlist just for that kind of work.
              </p>
            ) : (
              categoryLabels.map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-0"
                >
                  <p className="font-medium text-sm">{label}</p>
                  <select
                    value={settings.focusMusicProfiles[label] ?? ''}
                    onChange={(e) => setProfile(label, e.target.value)}
                    aria-label={`Focus music playlist for ${label}`}
                    className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs max-w-[10rem]"
                  >
                    <option value="">Use default</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.uri}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  )
}
