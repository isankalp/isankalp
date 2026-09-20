// Authenticated. Returns the Spotify authorize URL to redirect the browser to, with a signed,
// time-limited `state` param so spotify-oauth-callback can recover the calling user later without
// trusting anything Spotify or the client sends unverified.
import { authorizeUrl, requireUser, signState } from '../_shared/spotify.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401)

  const state = await signState(user.id)
  return jsonResponse({ url: authorizeUrl(state) })
})
