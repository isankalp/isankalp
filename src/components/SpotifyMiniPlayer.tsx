import { useSpotifyPlayer } from '../context/SpotifyPlayerContext'

// Epic 61: a small persistent player, visible whenever this app has started Spotify playback,
// so a focus session's music stays controllable without leaving the task view.
export default function SpotifyMiniPlayer() {
  const { visible, currentTrack, isPlaying, togglePlay, next, previous, dismiss, error, premiumRequired } = useSpotifyPlayer()

  if (!visible || !currentTrack) return null

  return (
    <div className="fixed bottom-3 right-3 z-20 w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-2.5 flex items-center gap-2.5">
      {currentTrack.album.images[0]?.url ? (
        <img src={currentTrack.album.images[0].url} alt="" className="w-10 h-10 rounded shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{currentTrack.name}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {currentTrack.artists.map((a) => a.name).join(', ')}
        </p>
        {(error || premiumRequired) && <p className="text-[10px] text-red-600 dark:text-red-400 truncate">{error}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={previous}
          aria-label="Previous track"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next track"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
        >
          ⏭
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide player"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-400"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
