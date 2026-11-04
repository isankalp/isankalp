import { requireSupabase } from './supabaseClient'

export interface SpotifyStatus {
  connected: boolean
  displayName?: string | null
  connectedAt?: string
}

export interface SpotifyAccessToken {
  access_token: string
  expires_at: string
}

/** Spotify features need both accounts configured and the user signed in — the refresh token is
 *  stored server-side keyed by the Supabase user id, so there's nowhere to keep it without one. */
export function spotifyAvailable(userId: string | null | undefined): boolean {
  return !!userId
}

async function invoke<T>(name: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = await requireSupabase()
  const { data, error } = await client.functions.invoke<T & { error?: string }>(name)
  if (error) return { ok: false, error: 'Spotify request failed — try again shortly' }
  if (data && 'error' in data && data.error) return { ok: false, error: data.error }
  return { ok: true, data: data as T }
}

export async function getSpotifyStatus(): Promise<{ ok: true; data: SpotifyStatus } | { ok: false; error: string }> {
  return invoke<SpotifyStatus>('spotify-status')
}

/** Starts the connect flow: fetches a signed authorize URL from the server, then does a normal
 *  full-page redirect to Spotify — the standard OAuth pattern, no popup/window juggling. */
export async function connectSpotify(): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await invoke<{ url: string }>('spotify-start')
  if (!result.ok) return result
  window.location.href = result.data.url
  return { ok: true }
}

export async function disconnectSpotify(): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await invoke<{ ok: true }>('spotify-disconnect')
  return result.ok ? { ok: true } : result
}

export async function getSpotifyAccessToken(): Promise<{ ok: true; data: SpotifyAccessToken } | { ok: false; error: string }> {
  return invoke<SpotifyAccessToken>('spotify-token')
}

let cachedToken: { token: string; expiresAt: number } | null = null
const TOKEN_SAFETY_BUFFER_MS = 30_000

async function ensureAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_SAFETY_BUFFER_MS) {
    return { ok: true, token: cachedToken.token }
  }
  const result = await getSpotifyAccessToken()
  if (!result.ok) return result
  cachedToken = { token: result.data.access_token, expiresAt: Date.parse(result.data.expires_at) }
  return { ok: true, token: cachedToken.token }
}

/** Calls the Spotify Web API directly from the browser with a short-lived access token fetched
 *  (and cached client-side until near expiry) on demand — the only Spotify credential the browser
 *  ever holds; the refresh token and client secret stay in spotify-token's server-side code. */
export async function spotifyApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; response: Response } | { ok: false; error: string }> {
  const tokenResult = await ensureAccessToken()
  if (!tokenResult.ok) return tokenResult
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${tokenResult.token}`, 'Content-Type': 'application/json' },
  })
  return { ok: true, response }
}
