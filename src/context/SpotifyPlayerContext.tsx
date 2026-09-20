import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getSpotifyAccessToken, getSpotifyStatus } from '../lib/spotifyClient'
import { playContextOnDevice, playUrisOnDevice } from '../lib/spotifyPlayback'
import { loadSpotifySdk } from '../lib/spotifyPlayer'

interface PlayResult {
  ok: boolean
  error?: string
}

interface SpotifyPlayerContextValue {
  /** The Spotify account itself is connected (Settings → Integrations), independent of whether
   *  the in-app player has been started yet this session. */
  connected: boolean
  /** The Web Playback SDK is loaded and this browser tab is a ready, named Spotify device. */
  deviceReady: boolean
  initializing: boolean
  premiumRequired: boolean
  error: string | null
  currentTrack: Spotify.Track | null
  isPlaying: boolean
  visible: boolean
  /** Lazily loads the SDK and connects a player the first time it's needed (starting a focus
   *  session, opening the mini-player) — never on every page load. Resolves once a device_id is
   *  ready, or false if that couldn't happen (not connected, not Premium, SDK failed, ...). */
  ensureReady: () => Promise<boolean>
  playContext: (contextUri: string) => Promise<PlayResult>
  playUris: (uris: string[]) => Promise<PlayResult>
  togglePlay: () => void
  next: () => void
  previous: () => void
  dismiss: () => void
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null)

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [deviceReady, setDeviceReady] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [premiumRequired, setPremiumRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTrack, setCurrentTrack] = useState<Spotify.Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [visible, setVisible] = useState(false)

  const playerRef = useRef<Spotify.Player | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const readyPromiseRef = useRef<Promise<boolean> | null>(null)

  useEffect(() => {
    if (!user) {
      setConnected(false)
      return
    }
    let cancelled = false
    getSpotifyStatus().then((result) => {
      if (!cancelled && result.ok) setConnected(result.data.connected)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    return () => {
      playerRef.current?.disconnect()
    }
  }, [])

  const ensureReady = useCallback((): Promise<boolean> => {
    if (deviceIdRef.current) return Promise.resolve(true)
    if (readyPromiseRef.current) return readyPromiseRef.current
    if (!connected) return Promise.resolve(false)

    setInitializing(true)
    setError(null)
    const promise = (async () => {
      try {
        const Spotify = await loadSpotifySdk()
        const player = new Spotify.Player({
          name: 'Goals Tracker',
          getOAuthToken: (cb) => {
            getSpotifyAccessToken().then((result) => {
              if (result.ok) cb(result.data.access_token)
            })
          },
        })
        playerRef.current = player

        player.addListener('player_state_changed', (state) => {
          if (!state) return
          setCurrentTrack(state.track_window.current_track)
          setIsPlaying(!state.paused)
          setVisible(true)
        })
        player.addListener('account_error', () => {
          setPremiumRequired(true)
          setError('Spotify Premium is required for in-app playback.')
        })
        player.addListener('authentication_error', () => setError('Spotify authentication failed — reconnect in Settings.'))
        player.addListener('initialization_error', () => setError("This browser can't play Spotify audio."))
        player.addListener('playback_error', () => setError('Playback error — try again.'))

        const ready = await new Promise<boolean>((resolve) => {
          player.addListener('ready', ({ device_id }) => {
            deviceIdRef.current = device_id
            setDeviceReady(true)
            resolve(true)
          })
          player.addListener('not_ready', () => setDeviceReady(false))
          player.connect().then((success) => {
            if (!success) resolve(false)
          })
        })
        return ready
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start the Spotify player.')
        return false
      } finally {
        setInitializing(false)
      }
    })()
    readyPromiseRef.current = promise
    return promise
  }, [connected])

  async function playContext(contextUri: string): Promise<PlayResult> {
    const ready = await ensureReady()
    if (!ready || !deviceIdRef.current) return { ok: false, error: error ?? 'Spotify is not ready' }
    const result = await playContextOnDevice(deviceIdRef.current, contextUri)
    if (!result.ok) setError(result.error)
    return result
  }

  async function playUris(uris: string[]): Promise<PlayResult> {
    const ready = await ensureReady()
    if (!ready || !deviceIdRef.current) return { ok: false, error: error ?? 'Spotify is not ready' }
    const result = await playUrisOnDevice(deviceIdRef.current, uris)
    if (!result.ok) setError(result.error)
    return result
  }

  function togglePlay() {
    playerRef.current?.togglePlay()
  }
  function next() {
    playerRef.current?.nextTrack()
  }
  function previous() {
    playerRef.current?.previousTrack()
  }
  function dismiss() {
    setVisible(false)
  }

  return (
    <SpotifyPlayerContext.Provider
      value={{
        connected,
        deviceReady,
        initializing,
        premiumRequired,
        error,
        currentTrack,
        isPlaying,
        visible,
        ensureReady,
        playContext,
        playUris,
        togglePlay,
        next,
        previous,
        dismiss,
      }}
    >
      {children}
    </SpotifyPlayerContext.Provider>
  )
}

export function useSpotifyPlayer(): SpotifyPlayerContextValue {
  const ctx = useContext(SpotifyPlayerContext)
  if (!ctx) throw new Error('useSpotifyPlayer must be used within SpotifyPlayerProvider')
  return ctx
}
