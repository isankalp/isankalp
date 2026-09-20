import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isPasswordValid } from '../lib/passwordPolicy'
import PasswordChecklist from '../components/PasswordChecklist'

/** PR-2/PR-3: Supabase redirects back here with error params in the URL when a recovery link
 *  is expired or has already been used, instead of establishing a session. */
function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const search = new URLSearchParams(window.location.search)
  const code = hash.get('error_code') ?? search.get('error_code')
  const error = hash.get('error') ?? search.get('error')
  if (code === 'otp_expired') return 'This link has expired — request a new one.'
  if (error) return 'This link has already been used — request a new one.'
  return null
}

export default function ResetPassword() {
  const { completePasswordReset, configured } = useAuth()
  const navigate = useNavigate()
  const [linkError] = useState<string | null>(readLinkError)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Clear Supabase's error/token params from the visible URL once read, without another navigation.
  useEffect(() => {
    if (window.location.hash || window.location.search) {
      window.history.replaceState({}, '', '/reset-password')
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isPasswordValid(password)) {
      setError('Password does not meet the requirements below.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await completePasswordReset(password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    // PR-5: the recovery session from the link is already an authenticated session, so
    // completing the reset logs the user in — no separate login step.
    navigate('/')
  }

  if (!configured) {
    return <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">Accounts aren't configured for this app.</p>
  }

  if (linkError) {
    return (
      <div className="max-w-sm mx-auto py-12 text-center">
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{linkError}</p>
        <button type="button" onClick={() => navigate('/')} className="text-xs text-indigo-600 dark:text-indigo-400 underline">
          Back to the app
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto py-8">
      <h2 className="text-lg font-bold mb-3">Set a new password</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-xs">
          <span className="text-slate-500 dark:text-slate-400">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-label="New password"
            className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <div className="mt-1">
            <PasswordChecklist password={password} />
          </div>
        </label>
        <label className="block text-xs">
          <span className="text-slate-500 dark:text-slate-400">Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            aria-label="Confirm new password"
            className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
        </label>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {submitting && <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
          Set new password
        </button>
      </form>
    </div>
  )
}
