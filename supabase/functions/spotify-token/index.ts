// Authenticated. Issues a short-lived Spotify access token on demand for the Web Playback SDK and
// playback-control calls — the only Spotify credential the browser ever sees. Refreshes it first if
// expired; the refresh token and client secret never leave this function.
import { refreshAccessToken, requireUser, serviceClient } from '../_shared/spotify.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const EXPIRY_SAFETY_BUFFER_MS = 60_000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401)

  const db = serviceClient()
  const { data: row, error } = await db
    .from('spotify_connections')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return jsonResponse({ error: 'Lookup failed' }, 500)
  if (!row) return jsonResponse({ error: 'Not connected' }, 404)

  const stillValid =
    row.access_token && row.access_token_expires_at && Date.parse(row.access_token_expires_at) - Date.now() > EXPIRY_SAFETY_BUFFER_MS

  if (stillValid) {
    return jsonResponse({ access_token: row.access_token, expires_at: row.access_token_expires_at })
  }

  try {
    const tokens = await refreshAccessToken(row.refresh_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    await db
      .from('spotify_connections')
      .update({
        access_token: tokens.access_token,
        access_token_expires_at: expiresAt,
        // Spotify only sometimes rotates the refresh token on refresh — keep the old one otherwise.
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      })
      .eq('user_id', user.id)
    return jsonResponse({ access_token: tokens.access_token, expires_at: expiresAt })
  } catch (err) {
    console.error('spotify-token refresh failed:', err)
    return jsonResponse({ error: 'Refresh failed — reconnect Spotify in Settings' }, 502)
  }
})
