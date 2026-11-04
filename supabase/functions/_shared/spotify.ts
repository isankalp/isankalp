// Shared helpers for the spotify-* Edge Functions. Deno runtime (Supabase Edge Functions).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SPOTIFY_SCOPES =
  'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-modify-private'

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_ME_URL = 'https://api.spotify.com/v1/me'

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required secret: ${name}`)
  return value
}

/** The URL this project's spotify-oauth-callback function is reachable at — what must be
 *  registered as a Redirect URI in the Spotify app's dashboard, exactly. */
export function callbackUrl(): string {
  return `${env('SUPABASE_URL')}/functions/v1/spotify-oauth-callback`
}

/** Identifies the calling user from their own Supabase session JWT (never the anon/service key)
 *  passed in the Authorization header — the standard pattern for an authenticated Edge Function. */
export async function requireUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return { id: data.user.id }
}

/** Full DB access, bypassing RLS — only ever used inside these Edge Functions, never sent to the
 *  browser. This is what lets spotify_connections have zero client-facing RLS policies. */
export function serviceClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface StatePayload {
  userId: string
  nonce: string
  exp: number
}

/** Signs a tamper-evident, time-limited state param so spotify-oauth-callback — reached via a
 *  plain top-level browser redirect with no session of its own — can recover which Supabase user
 *  started the connect flow, without trusting anything the client (or Spotify) sends unverified. */
export async function signState(userId: string): Promise<string> {
  const payload: StatePayload = { userId, nonce: crypto.randomUUID(), exp: Date.now() + 10 * 60_000 }
  const body = btoa(JSON.stringify(payload))
  const sig = await hmacSign(body, env('SPOTIFY_STATE_SECRET'))
  return `${body}.${sig}`
}

export async function verifyState(state: string): Promise<string | null> {
  const [body, sig] = state.split('.')
  if (!body || !sig) return null
  const expectedSig = await hmacSign(body, env('SPOTIFY_STATE_SECRET'))
  if (sig !== expectedSig) return null
  try {
    const payload = JSON.parse(atob(body)) as StatePayload
    if (Date.now() > payload.exp) return null
    return payload.userId
  } catch {
    return null
  }
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: callbackUrl(),
    scope: SPOTIFY_SCOPES,
    state,
  })
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

function basicAuthHeader(): string {
  return 'Basic ' + btoa(`${env('SPOTIFY_CLIENT_ID')}:${env('SPOTIFY_CLIENT_SECRET')}`)
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl() }),
  })
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function fetchSpotifyProfile(accessToken: string): Promise<{ id: string; display_name: string | null }> {
  const res = await fetch(SPOTIFY_ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Spotify profile fetch failed: ${res.status} ${await res.text()}`)
  return res.json()
}
