import { spotifyApiFetch } from './spotifyClient'

export interface SpotifyPlaylist {
  id: string
  name: string
  uri: string
  imageUrl: string | null
  trackCount: number
}

interface RawSpotifyPlaylist {
  id: string
  name: string
  uri: string
  images?: { url: string }[]
  tracks?: { total: number }
}

async function ok(response: Response): Promise<{ ok: true } | { ok: false; error: string }> {
  if (response.ok || response.status === 204) return { ok: true }
  if (response.status === 404) return { ok: false, error: 'No active Spotify device — open the mini-player first' }
  if (response.status === 403) return { ok: false, error: 'Spotify Premium is required for in-app playback' }
  return { ok: false, error: `Spotify request failed (${response.status})` }
}

export async function fetchUserPlaylists(): Promise<{ ok: true; data: SpotifyPlaylist[] } | { ok: false; error: string }> {
  const result = await spotifyApiFetch('/me/playlists?limit=50')
  if (!result.ok) return result
  if (!result.response.ok) return { ok: false, error: `Couldn't load playlists (${result.response.status})` }
  const json = (await result.response.json()) as { items?: RawSpotifyPlaylist[] }
  const data: SpotifyPlaylist[] = (json.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    uri: p.uri,
    imageUrl: p.images?.[0]?.url ?? null,
    trackCount: p.tracks?.total ?? 0,
  }))
  return { ok: true, data }
}

export async function playContextOnDevice(deviceId: string, contextUri: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await spotifyApiFetch(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: contextUri }),
  })
  if (!result.ok) return result
  return ok(result.response)
}

export async function playUrisOnDevice(deviceId: string, uris: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await spotifyApiFetch(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris }),
  })
  if (!result.ok) return result
  return ok(result.response)
}

export async function transferPlaybackToDevice(deviceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await spotifyApiFetch('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  })
  if (!result.ok) return result
  return ok(result.response)
}
