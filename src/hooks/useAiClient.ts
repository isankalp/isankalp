import { useSettings } from '../context/SettingsContext'
import { aiConfigured } from '../lib/aiHelpers'
import { generateStructured, generateText, type ClaudeMessage, type ClaudeResult } from '../lib/claudeClient'

const NOT_CONFIGURED_MESSAGE = 'Add your Claude API key in Settings to enable this'

/** Single entry point every AI feature uses: gates on AK-3, counts usage on success (AK-5), and
 *  saves every caller from re-reading the key out of settings themselves. */
export function useAiClient() {
  const { settings, updateSettings } = useSettings()
  const configured = aiConfigured(settings)

  async function recordUsage(): Promise<void> {
    await updateSettings({ aiRequestCount: settings.aiRequestCount + 1 })
  }

  async function text(opts: { system?: string; messages: ClaudeMessage[]; maxTokens?: number }): Promise<ClaudeResult<string>> {
    if (!configured) return { ok: false, error: { kind: 'invalid_key', message: NOT_CONFIGURED_MESSAGE } }
    const result = await generateText(settings.aiApiKey!, opts)
    if (result.ok) await recordUsage()
    return result
  }

  async function structured<T>(opts: {
    system?: string
    messages: ClaudeMessage[]
    toolName: string
    toolDescription: string
    inputSchema: Record<string, unknown>
    maxTokens?: number
  }): Promise<ClaudeResult<T>> {
    if (!configured) return { ok: false, error: { kind: 'invalid_key', message: NOT_CONFIGURED_MESSAGE } }
    const result = await generateStructured<T>(settings.aiApiKey!, opts)
    if (result.ok) await recordUsage()
    return result
  }

  return { configured, text, structured }
}
