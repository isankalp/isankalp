// Loads Spotify's Web Playback SDK script exactly once, on demand — never fetched unless a
// signed-in user actually reaches a screen that needs in-app playback, so the ~40KB script costs
// nothing to everyone else.
let sdkLoadPromise: Promise<typeof Spotify> | null = null

export function loadSpotifySdk(): Promise<typeof Spotify> {
  if (window.Spotify) return Promise.resolve(window.Spotify)
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify) resolve(window.Spotify)
      else reject(new Error('Spotify SDK loaded but window.Spotify is missing'))
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => reject(new Error('Failed to load the Spotify player script'))
    document.body.appendChild(script)
  })
  return sdkLoadPromise
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
