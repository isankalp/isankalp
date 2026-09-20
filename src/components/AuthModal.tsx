import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { isPasswordValid } from '../lib/passwordPolicy'
import { getLockoutStatus, recordFailedLoginAttempt, recordSuccessfulLogin } from '../lib/authLockout'
import PasswordChecklist from './PasswordChecklist'

type Mode = 'signup' | 'login' | 'forgot'

export default function AuthModal({
  initialMode,
  onClose,
  onAuthenticated,
}: {
  initialMode: Mode
  onClose: () => void
  onAuthenticated: () => void
}) {
  const { signUp, logIn, continueWithGoogle, requestPasswordReset, isValidEmail, configured } = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0)

  const passwordOk = mode === 'forgot' || isPasswordValid(password)
  const emailOk = isValidEmail(email)

  function tickLockout(seconds: number) {
    setLockoutRemainingMs(seconds)
    if (seconds <= 0) return
    const id = setInterval(() => {
      setLockoutRemainingMs((ms) => {
        if (ms <= 1000) {
          clearInterval(id)
          return 0
        }
        return ms - 1000
      })
    }, 1000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setEmailError(null)

    if (!emailOk) {
      setEmailError('Enter a valid email address')
      return
    }

    if (mode === 'forgot') {
      setSubmitting(true)
      await requestPasswordReset(email)
      setSubmitting(false)
      // PR-1: identical confirmation regardless of whether the email has an account.
      setForgotSent(true)
      return
    }

    if (mode === 'login') {
      const status = getLockoutStatus(email)
      if (status.locked) {
        tickLockout(status.remainingMs)
        return
      }
    }

    if (!passwordOk) {
      setFormError('Password does not meet the requirements below.')
      return
    }

    setSubmitting(true)
    if (mode === 'signup') {
      const result = await signUp(email, password)
      setSubmitting(false)
      if (result.duplicate) {
        setFormError('An account already exists with this email.')
        return
      }
      if (result.error) {
        setFormError(result.error)
        return
      }
      onAuthenticated()
      return
    }

    // mode === 'login'
    const result = await logIn(email, password)
    setSubmitting(false)
    if (result.error) {
      recordFailedLoginAttempt(email)
      const status = getLockoutStatus(email)
      if (status.locked) tickLockout(status.remainingMs)
      setFormError(result.error)
      return
    }
    recordSuccessfulLogin(email)
    onAuthenticated()
  }

  async function handleGoogle() {
    setFormError(null)
    setSubmitting(true)
    const result = await continueWithGoogle()
    setSubmitting(false)
    if (result.error) setFormError(result.error)
    // On success the browser navigates away to Google's consent screen — nothing more to do here.
  }

  const title = mode === 'signup' ? 'Sign Up' : mode === 'login' ? 'Log In' : 'Reset your password'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-sm">
            ✕
          </button>
        </div>

        {!configured ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Accounts aren't configured for this app yet — set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to enable Sign Up / Log In.
          </p>
        ) : mode === 'forgot' && forgotSent ? (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your email.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-2">
            <label className="block text-xs">
              <span className="text-slate-500 dark:text-slate-400">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError(null)
                }}
                autoComplete="email"
                aria-label="Email"
                className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
              />
              {emailError && <span className="text-red-600 dark:text-red-400">{emailError}</span>}
            </label>

            {mode !== 'forgot' && (
              <label className="block text-xs">
                <span className="text-slate-500 dark:text-slate-400">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  aria-label="Password"
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
                />
                {mode === 'signup' && <div className="mt-1"><PasswordChecklist password={password} /></div>}
              </label>
            )}

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setFormError(null)
                }}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 underline"
              >
                Forgot password?
              </button>
            )}

            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

            {mode === 'login' && lockoutRemainingMs > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
                Too many failed attempts. Try again in {Math.ceil(lockoutRemainingMs / 1000)}s.
              </p>
            ) : (
              <button
                type="submit"
                disabled={submitting || (mode === 'signup' && (!passwordOk || !emailOk || !email))}
                className="w-full px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting && <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
                {mode === 'signup' ? 'Sign Up' : mode === 'login' ? 'Log In' : 'Send reset link'}
              </button>
            )}

            {mode !== 'forgot' && (
              <>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  or
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={submitting}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Continue with Google
                </button>
              </>
            )}

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 pt-1">
              {mode === 'signup' && (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => setMode('login')} className="text-indigo-600 dark:text-indigo-400 underline">
                    Log in
                  </button>
                </>
              )}
              {mode === 'login' && (
                <>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setMode('signup')} className="text-indigo-600 dark:text-indigo-400 underline">
                    Sign up
                  </button>
                </>
              )}
              {mode === 'forgot' && (
                <button type="button" onClick={() => setMode('login')} className="text-indigo-600 dark:text-indigo-400 underline">
                  Back to log in
                </button>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
