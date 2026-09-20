import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { aiConfigured, maskApiKey } from '../lib/aiHelpers'
import { validateApiKey } from '../lib/claudeClient'

/** Epic 58: Settings → AI. Manages the BYOK Claude API key and per-feature toggles. Every other AI
 *  feature in the app is gated purely on aiConfigured(settings) — this is the only place the raw key
 *  is ever handled. */
export default function AISettings() {
  const { settings, updateSettings } = useSettings()
  const [keyInput, setKeyInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)

  const configured = aiConfigured(settings)

  async function handleSave() {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    setValidating(true)
    setError(null)
    const result = await validateApiKey(trimmed)
    setValidating(false)
    if (!result.ok) {
      setError(result.error.kind === 'invalid_key' ? 'Key invalid or rejected' : result.error.message)
      return
    }
    await updateSettings({ aiApiKey: trimmed, aiRequestCount: 0, aiRequestCountSince: Date.now() })
    setKeyInput('')
    setReplacing(false)
  }

  async function handleRemove() {
    // AK-6: previously generated content (recaps, saved tasks) is untouched — this only clears the key.
    await updateSettings({ aiApiKey: undefined })
    setReplacing(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 divide-y divide-slate-200 dark:divide-slate-700">
      <div className="py-3">
        <p className="text-xs font-medium mb-1">Claude API key</p>
        {!configured || replacing ? (
          <>
            {!configured && !replacing && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">No key added — AI features are off.</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value)
                  setError(null)
                }}
                placeholder="sk-ant-..."
                autoComplete="off"
                className="flex-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={validating || !keyInput.trim()}
                className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {validating && <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
                Save
              </button>
              {replacing && (
                <button
                  type="button"
                  onClick={() => {
                    setReplacing(false)
                    setKeyInput('')
                    setError(null)
                  }}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              )}
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <code className="text-xs text-slate-600 dark:text-slate-300">{maskApiKey(settings.aiApiKey!)}</code>
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="px-2.5 py-1 rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-[11px] font-medium hover:bg-red-50 dark:hover:bg-red-950"
            >
              Remove Key
            </button>
          </div>
        )}
      </div>

      {configured && !replacing && (
        <>
          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium">AI requests this period</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tracked by this app only — not a verified read of your Anthropic billing dashboard.
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0">{settings.aiRequestCount}</span>
          </div>

          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium">Analyze my journal</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lets Journal Coaching read your entries. Other AI features work either way.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ journalAnalysisEnabled: !settings.journalAnalysisEnabled })}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                settings.journalAnalysisEnabled
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {settings.journalAnalysisEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium">Auto-tagging</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Suggest tags on new tasks. Always editable before save.</p>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ autoTaggingEnabled: !settings.autoTaggingEnabled })}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                settings.autoTaggingEnabled
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {settings.autoTaggingEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
