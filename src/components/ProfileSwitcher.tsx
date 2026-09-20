import { useState } from 'react'
import { createProfile, getActiveProfileId, listProfiles, switchActiveProfile } from '../lib/profiles'

export default function ProfileSwitcher() {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const profiles = listProfiles()
  const activeId = getActiveProfileId()
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]

  function handleCreate() {
    try {
      const profile = createProfile(name)
      setError(null)
      setCreating(false)
      setName('')
      switchActiveProfile(profile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile.')
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1"
      >
        👤 {active?.name ?? 'Personal'}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-20 p-1.5 text-xs">
          <ul className="space-y-0.5">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (p.id !== activeId) switchActiveProfile(p.id)
                  }}
                  className={`w-full text-left px-2 py-1 rounded-md ${
                    p.id === activeId ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.name} {p.id === activeId && '✓'}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 dark:border-slate-700 mt-1.5 pt-1.5">
            {creating ? (
              <div className="space-y-1">
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Profile name"
                  maxLength={40}
                  className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
                {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex gap-1">
                  <button type="button" onClick={handleCreate} className="flex-1 px-2 py-1 rounded-md bg-indigo-600 text-white font-medium">
                    Create
                  </button>
                  <button type="button" onClick={() => setCreating(false)} className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-medium"
              >
                + New Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
