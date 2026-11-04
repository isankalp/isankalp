import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isPasswordValid } from '../lib/passwordPolicy'
import PasswordChecklist from './PasswordChecklist'

/** AM-1..5: Settings → Account. Renders nothing when accounts aren't configured or the user is logged out. */
export default function AccountSettings() {
  const { configured, user, emailVerified, isValidEmail, updateEmail, updatePassword } = useAuth()

  const [newEmail, setNewEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSubmitting, setEmailSubmitting] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  if (!configured) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Accounts aren't configured for this app yet — set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to enable Sign Up / Log In.
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">Log in (top right) to manage your account email and password.</p>
      </div>
    )
  }

  async function handleEmailSubmit() {
    setEmailError(null)
    setEmailStatus(null)
    if (!isValidEmail(newEmail)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmailSubmitting(true)
    const result = await updateEmail(newEmail)
    setEmailSubmitting(false)
    if (result.error) {
      setEmailError(result.error)
      return
    }
    // AM-1: the account email only actually changes once the link sent to the new address is confirmed.
    setEmailStatus(`Verification link sent to ${newEmail}. Your email updates once you confirm it.`)
    setNewEmail('')
  }

  async function handlePasswordSubmit() {
    setPasswordError(null)
    setPasswordStatus(null)
    if (!isPasswordValid(newPassword)) {
      setPasswordError('New password does not meet the requirements below.')
      return
    }
    setPasswordSubmitting(true)
    const result = await updatePassword(currentPassword, newPassword)
    setPasswordSubmitting(false)
    if (result.error) {
      setPasswordError(result.error)
      return
    }
    setPasswordStatus('Password changed. Your other active sessions have been logged out.')
    setCurrentPassword('')
    setNewPassword('')
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3 space-y-4">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Signed in as <strong>{user.email}</strong>
          {!emailVerified && ' (unverified)'}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-1.5">Change email</p>
        <div className="flex items-center gap-1.5">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email address"
            aria-label="New email address"
            className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <button
            type="button"
            onClick={handleEmailSubmit}
            disabled={emailSubmitting || !newEmail}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Update
          </button>
        </div>
        {emailError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{emailError}</p>}
        {emailStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{emailStatus}</p>}
      </div>

      <div>
        <p className="text-xs font-medium mb-1.5">Change password</p>
        <div className="space-y-1.5">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            aria-label="Current password"
            className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            aria-label="New password"
            className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <PasswordChecklist password={newPassword} />
          <button
            type="button"
            onClick={handlePasswordSubmit}
            disabled={passwordSubmitting || !currentPassword || !newPassword}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Change password
          </button>
        </div>
        {passwordError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{passwordError}</p>}
        {passwordStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{passwordStatus}</p>}
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Sessions stay signed in until you log out, or after 30 days of inactivity (configured on the account's Supabase project).
      </p>
    </div>
  )
}
