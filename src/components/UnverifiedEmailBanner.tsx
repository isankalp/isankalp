import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const RESEND_COOLDOWN_MS = 60_000

/** AM-3/AM-4: core task-tracking stays fully usable while unverified — this is informational only,
 *  never a lockout. */
export default function UnverifiedEmailBanner() {
  const { configured, user, emailVerified, resendVerification } = useAuth()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [onCooldown, setOnCooldown] = useState(false)

  if (!configured || !user || emailVerified) return null

  async function handleResend() {
    setStatus('sending')
    const result = await resendVerification()
    if (result.error) {
      setStatus('error')
      return
    }
    setStatus('sent')
    setOnCooldown(true)
    setTimeout(() => setOnCooldown(false), RESEND_COOLDOWN_MS)
  }

  return (
    <div className="border-b border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
      <span>Verify your email to unlock account features like sync. Task tracking works fully either way.</span>
      <div className="flex items-center gap-2 shrink-0">
        {status === 'sent' && <span>Sent!</span>}
        {status === 'error' && <span className="text-red-600 dark:text-red-400">Failed to send — try again.</span>}
        <button
          type="button"
          onClick={handleResend}
          disabled={status === 'sending' || onCooldown}
          className="underline font-medium disabled:opacity-50 disabled:no-underline"
        >
          Resend verification email
        </button>
      </div>
    </div>
  )
}
