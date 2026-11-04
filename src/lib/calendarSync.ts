import { db } from '../db/db'
import { totalMinutes, type Task } from '../db/models'

// Real Google OAuth 2.0 Authorization Code + PKCE flow. Needs a real client id from Google Cloud
// Console (Settings → Integrations shows exactly this): set VITE_GOOGLE_CLIENT_ID at build time.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN_KEY = 'goals-tracker:googleCalendarToken'
const VERIFIER_KEY = 'goals-tracker:googleCalendarPkceVerifier'

interface StoredToken {
  accessToken: string
  expiresAt: number
}

function base64url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return new Uint8Array(digest)
}

function randomVerifier(): string {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

export function calendarConfigured(): boolean {
  return !!CLIENT_ID
}

export function hasCalendarToken(): boolean {
  return !!getToken()
}

function getToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

/** Opens Google's consent screen in a popup. The redirect page must call completeGoogleCalendarAuth with ?code=. */
export async function connectGoogleCalendar(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Google Calendar is not configured (missing VITE_GOOGLE_CLIENT_ID).')
  const verifier = randomVerifier()
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = base64url(await sha256(verifier))
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', `${window.location.origin}/settings`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  window.open(url.toString(), 'google-oauth', 'width=480,height=640')
}

export async function completeGoogleCalendarAuth(code: string): Promise<void> {
  if (!CLIENT_ID) throw new Error('Google Calendar is not configured (missing VITE_GOOGLE_CLIENT_ID).')
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('Missing PKCE verifier — restart the connection flow.')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: `${window.location.origin}/settings`,
    }),
  })
  if (!res.ok) throw new Error('Google Calendar authorization failed.')
  const json = (await res.json()) as { access_token: string; expires_in: number }
  const token: StoredToken = { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}

export function disconnectGoogleCalendar(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export interface SyncResult {
  synced: number
  failed: number
}

/** IE-2/3: pushes today's incomplete tasks as calendar events sized to remaining minutes, updating existing events in place. */
export async function syncTodayToCalendar(dayTasks: Task[]): Promise<SyncResult> {
  const token = getToken()
  if (!token) throw new Error('Google Calendar is not connected.')
  if (Date.now() >= token.expiresAt) throw new Error('Google Calendar session expired — reconnect in Settings.')

  const incomplete = dayTasks.filter((t) => t.completedSubtasks < t.totalSubtasks)
  let synced = 0
  let failed = 0
  for (const task of incomplete) {
    try {
      const remainingSubtasks = task.totalSubtasks - task.completedSubtasks
      const remainingMinutes = remainingSubtasks * task.minutesPerSubtask
      const start = new Date()
      const end = new Date(start.getTime() + remainingMinutes * 60_000)
      const body = {
        summary: task.title,
        description: `${remainingSubtasks} of ${task.totalSubtasks} subtasks remaining (${remainingMinutes} min of ${totalMinutes(task)} min planned).`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }
      const url = task.googleEventId
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.googleEventId}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      const res = await fetch(url, {
        method: task.googleEventId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Calendar API returned ${res.status}`)
      const event = (await res.json()) as { id: string }
      await db.tasks.update(task.id, { googleEventId: event.id })
      synced++
    } catch {
      failed++
    }
  }
  return { synced, failed }
}
