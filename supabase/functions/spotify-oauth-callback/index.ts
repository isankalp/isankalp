// Reached via a plain top-level browser redirect from Spotify (never fetched by the app's own
// code) after the user approves or denies access. Exchanges the code for tokens, stores them
// server-side, and redirects the browser back into the app.
import { exchangeCodeForTokens, fetchSpotifyProfile, serviceClient, verifyState } from '../_shared/spotify.ts'

function appRedirect(path: string): Response {
  const appUrl = Deno.env.get('APP_URL')
  if (!appUrl) return new Response('Missing required secret: APP_URL', { status: 500 })
  return Response.redirect(`${appUrl.replace(/\/$/, '')}${path}`, 302)
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const spotifyError = url.searchParams.get('error')

  if (spotifyError || !code || !state) {
    return appRedirect(`/settings?spotify=error&reason=${encodeURIComponent(spotifyError ?? 'missing_code')}`)
  }

  const userId = await verifyState(state)
  if (!userId) return appRedirect('/settings?spotify=error&reason=invalid_state')

  try {
    const tokens = await exchangeCodeForTokens(code)
    const profile = await fetchSpotifyProfile(tokens.access_token)

    const db = serviceClient()
    const { error } = await db.from('spotify_connections').upsert({
      user_id: userId,
      spotify_user_id: profile.id,
      spotify_display_name: profile.display_name,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      connected_at: new Date().toISOString(),
    })
    if (error) throw error

    return appRedirect('/settings?spotify=connected')
  } catch (err) {
    console.error('spotify-oauth-callback failed:', err)
    return appRedirect('/settings?spotify=error&reason=server_error')
  }
})
