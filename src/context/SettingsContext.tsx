import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { db } from '../db/db'
import { DEFAULT_SETTINGS, type Settings } from '../db/models'

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Omit<Settings, 'id'>>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS

  useEffect(() => {
    db.settings.get('settings').then((existing) => {
      if (!existing) db.settings.put(DEFAULT_SETTINGS)
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
    const current = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
    await db.settings.put({ ...current, ...patch })
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
