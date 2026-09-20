// Authenticated. Tells the client whether Spotify is connected and its display name only — never
// the tokens, which is the whole reason a dedicated status endpoint exists instead of letting the
// client query spotify_connections directly.
import { requireUser, serviceClient } from '../_shared/spotify.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401)

  const db = serviceClient()
  const { data: row, error } = await db
    .from('spotify_connections')
    .select('spotify_display_name, connected_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return jsonResponse({ error: 'Lookup failed' }, 500)
  if (!row) return jsonResponse({ connected: false })

  return jsonResponse({ connected: true, displayName: row.spotify_display_name, connectedAt: row.connected_at })
})
