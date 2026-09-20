import type { SupabaseClient } from '@supabase/supabase-js'

// Real Supabase-backed auth (Epics 48-51). Needs a real project: set VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY at build time (Settings → Account shows exactly this when missing).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function authConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY
}

let clientPromise: Promise<SupabaseClient | null> | null = null

/**
 * The @supabase/supabase-js SDK is a meaningful chunk of bytes (~60KB gzipped) that the large
 * majority of users — running fully local-first with no Supabase project configured — should
 * never have to download. Dynamically imported, and only when accounts are actually configured,
 * so it's entirely absent from the bundle every other user loads.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!authConfigured()) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    )
  }
  return clientPromise
}

/** Throws a clear, consistent error at every call site instead of a null-pointer crash. */
export async function requireSupabase(): Promise<SupabaseClient> {
  const client = await getSupabase()
  if (!client) throw new Error('Accounts are not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return client
}
