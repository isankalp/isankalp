import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'

/** Header-level Sign Up / Log In entry points, or a logged-in user chip + Log Out (LI-6). */
export default function AuthHeaderControl() {
  const { configured, user, logOut } = useAuth()
  const [modalMode, setModalMode] = useState<'signup' | 'login' | null>(null)

  if (!configured) return null

  if (user) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={user.email}>
          {user.email}
        </span>
        <button
          type="button"
          onClick={() => logOut()}
          className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Log Out
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => setModalMode('login')}
        className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        Log In
      </button>
      <button
        type="button"
        onClick={() => setModalMode('signup')}
        className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700"
      >
        Sign Up
      </button>
      {modalMode && (
        <AuthModal
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onAuthenticated={() => setModalMode(null)}
        />
      )}
    </div>
  )
}
