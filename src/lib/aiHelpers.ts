import type { Settings } from '../db/models'

/** AK-3: the single gate every AI feature checks before attempting a request. */
export function aiConfigured(settings: Pick<Settings, 'aiApiKey'>): boolean {
  return !!settings.aiApiKey && settings.aiApiKey.trim().length > 0
}

/** AK-4: the key is never shown in full again after saving — only this masked form. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`
}
