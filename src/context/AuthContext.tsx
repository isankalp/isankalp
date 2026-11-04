import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authConfigured, getSupabase, requireSupabase } from '../lib/supabaseClient'
import { setCloudMode } from '../db/db'

const GENERIC_LOGIN_ERROR = 'Incorrect email or password'
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AuthContextValue {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  emailVerified: boolean
  isValidEmail: (email: string) => boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null; duplicate: boolean }>
  logIn: (email: string, password: string) => Promise<{ error: string | null }>
  continueWithGoogle: () => Promise<{ error: string | null }>
  logOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  completePasswordReset: (newPassword: string) => Promise<{ error: string | null }>
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>
  resendVerification: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = authConfigured()
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!configured) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    getSupabase().then((client) => {
      if (!client || cancelled) return
      client.auth.getSession().then(({ data }) => {
        if (cancelled) return
        setSession(data.session)
        setLoading(false)
      })
      const { data: listener } = client.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession)
      })
      unsubscribe = () => listener.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configured is derived from env vars, fixed for the app's lifetime
  }, [])

  // The app's entire data source flips the instant the session changes: signed out (or accounts not
  // configured) means local-first IndexedDB, exactly as before v9; signed in means every read/write
  // goes to this account's cloud tables instead, from any device.
  useEffect(() => {
    setCloudMode(session?.user.id ?? null)
  }, [session])

  function isValidEmail(email: string): boolean {
    return EMAIL_FORMAT_RE.test(email.trim())
  }

  async function signUp(email: string, password: string): Promise<{ error: string | null; duplicate: boolean }> {
    const client = await requireSupabase()
    const { data, error } = await client.auth.signUp({ email: email.trim(), password })
    if (error) return { error: error.message, duplicate: false }
    // SU-3: Supabase's anti-enumeration default returns success (no error) for an email that
    // already has a confirmed account, but with an empty `identities` array — the documented
    // way to detect this client-side without disabling that protection everywhere else.
    const duplicate = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    if (duplicate) return { error: 'An account already exists with this email.', duplicate: true }
    return { error: null, duplicate: false }
  }

  async function logIn(email: string, password: string): Promise<{ error: string | null }> {
    const client = await requireSupabase()
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    // LI-2: always the same generic message, regardless of which field (or both) was wrong.
    if (error) return { error: GENERIC_LOGIN_ERROR }
    return { error: null }
  }

  async function continueWithGoogle(): Promise<{ error: string | null }> {
    const client = await requireSupabase()
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error: error ? error.message : null }
  }

  async function logOut(): Promise<void> {
    const client = await requireSupabase()
    await client.auth.signOut()
  }

  async function requestPasswordReset(email: string): Promise<void> {
    const client = await requireSupabase()
    // PR-1: identical outcome shown to the user whether or not this succeeds — never reveals
    // account existence. Any failure is swallowed here on purpose.
    await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    }).catch(() => undefined)
  }

  async function completePasswordReset(newPassword: string): Promise<{ error: string | null }> {
    const client = await requireSupabase()
    const { error } = await client.auth.updateUser({ password: newPassword })
    return { error: error ? error.message : null }
  }

  async function updateEmail(newEmail: string): Promise<{ error: string | null }> {
    const client = await requireSupabase()
    // AM-1: Supabase sends a verification link to the NEW address and only swaps the account
    // email over once that link is confirmed — the email on `user` doesn't change until then.
    const { error } = await client.auth.updateUser({ email: newEmail.trim() })
    return { error: error ? error.message : null }
  }

  async function updatePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
    const client = await requireSupabase()
    const email = session?.user.email
    if (!email) return { error: 'You must be logged in.' }
    // Verify the current password first (AM-2 requires it), rather than trusting the live session alone.
    const { error: verifyError } = await client.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) return { error: 'Current password is incorrect.' }
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    // AM-2: log out every other active session. Falls back to a no-op if this SDK/project
    // version doesn't support scoped sign-out — the password itself is still changed either way.
    await client.auth.signOut({ scope: 'others' }).catch(() => undefined)
    return { error: null }
  }

  async function resendVerification(): Promise<{ error: string | null }> {
    const client = await requireSupabase()
    const email = session?.user.email
    if (!email) return { error: 'You must be logged in.' }
    const { error } = await client.auth.resend({ type: 'signup', email })
    return { error: error ? error.message : null }
  }

  const user = session?.user ?? null
  const emailVerified = !!user?.email_confirmed_at

  return (
    <AuthContext.Provider
      value={{
        configured,
        loading,
        session,
        user,
        emailVerified,
        isValidEmail,
        signUp,
        logIn,
        continueWithGoogle,
        logOut,
        requestPasswordReset,
        completePasswordReset,
        updateEmail,
        updatePassword,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
