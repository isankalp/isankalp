// Minimal ambient types for Spotify's Web Playback SDK (loaded at runtime from
// https://sdk.scdn.co/spotify-player.js — there's no official @types package).
export {}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: typeof Spotify
  }

  namespace Spotify {
    interface PlayerInit {
      name: string
      getOAuthToken: (cb: (token: string) => void) => void
      volume?: number
    }

    interface Track {
      uri: string
      id: string | null
      name: string
      album: { name: string; images: { url: string }[] }
      artists: { name: string }[]
      duration_ms: number
    }

    interface PlaybackState {
      paused: boolean
      position: number
      duration: number
      track_window: { current_track: Track }
    }

    interface WebPlaybackError {
      message: string
    }

    class Player {
      constructor(init: PlayerInit)
      connect(): Promise<boolean>
      disconnect(): void
      addListener(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): boolean
      addListener(event: 'player_state_changed', cb: (state: PlaybackState | null) => void): boolean
      addListener(
        event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
        cb: (error: WebPlaybackError) => void,
      ): boolean
      removeListener(event: string): void
      getCurrentState(): Promise<PlaybackState | null>
      togglePlay(): Promise<void>
      pause(): Promise<void>
      resume(): Promise<void>
      nextTrack(): Promise<void>
      previousTrack(): Promise<void>
      seek(positionMs: number): Promise<void>
      setVolume(volume: number): Promise<void>
    }
  }
}
