// Authenticated. Deletes the caller's stored Spotify connection. Spotify has no documented
// programmatic token-revocation endpoint, so this relies on simply forgetting the refresh token —
// the user can also revoke the app's access directly from their Spotify account settings.
import { requireUser, serviceClient } from '../_shared/spotify.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401)

  const db = serviceClient()
  const { error } = await db.from('spotify_connections').delete().eq('user_id', user.id)
  if (error) return jsonResponse({ error: 'Disconnect failed' }, 500)

  return jsonResponse({ ok: true })
})
