import { useEffect, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { useAiClient } from '../hooks/useAiClient'
import { useSettings } from '../context/SettingsContext'

const THEMES_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          theme: { type: 'string', description: "A recurring theme, quoting or closely paraphrasing the user's own words" },
          occurrences: { type: 'number' },
        },
        required: ['theme', 'occurrences'],
      },
      description: 'Only themes mentioned more than once — omit anything that appears only once',
    },
  },
  required: ['themes'],
}

const MIN_ENTRIES_FOR_THEMES = 10

/** Epic 57: Journal Coaching. Entirely gated on journalAnalysisEnabled (JC-5) — the page simply
 *  doesn't render its AI sections if that's off, on top of the usual aiConfigured gate. */
export default function JournalInsights() {
  const { configured, text, structured } = useAiClient()
  const { settings } = useSettings()
  const entries = useLiveQuery(() => db.journalEntries.orderBy('date').reverse().toArray(), []) ?? []

  const [coachMessage, setCoachMessage] = useState<string | null>(null)
  const [coachStatus, setCoachStatus] = useState<'idle' | 'loading' | 'not-enough' | 'error'>('idle')
  const [themes, setThemes] = useState<{ theme: string; occurrences: number }[] | null>(null)
  const [themesStatus, setThemesStatus] = useState<'idle' | 'loading' | 'not-enough' | 'error'>('idle')

  const analysisAllowed = configured && settings.journalAnalysisEnabled

  useEffect(() => {
    if (!analysisAllowed) return
    const recent = entries.slice(0, 14)
    if (recent.length === 0) {
      setCoachStatus('not-enough')
      return
    }
    let cancelled = false
    setCoachStatus('loading')
    text({
      system:
        "Read these recent journal entries and write one short (1-2 sentence) coaching message. Calibrate tone to what's actually expressed — encouraging after a rough stretch, matter-of-fact after a strong one. Only reflect sentiment the user actually wrote; never diagnose, label, or infer an unstated mood or condition.",
      messages: [{ role: 'user', content: recent.map((e) => `${e.date}: ${e.text}`).join('\n\n') }],
      maxTokens: 150,
    }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setCoachStatus('error')
        return
      }
      setCoachMessage(result.data)
      setCoachStatus('idle')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the entry set identity changes
  }, [analysisAllowed, entries.length])

  useEffect(() => {
    if (!analysisAllowed) return
    if (entries.length < MIN_ENTRIES_FOR_THEMES) {
      setThemesStatus('not-enough')
      return
    }
    let cancelled = false
    setThemesStatus('loading')
    structured<{ themes: { theme: string; occurrences: number }[] }>({
      system:
        "Find themes mentioned more than once across these journal entries, quoting or closely paraphrasing the user's own words. Stay descriptive — state the pattern factually, never offer a psychological explanation or label for why it's happening.",
      messages: [{ role: 'user', content: entries.map((e) => `${e.date}: ${e.text}`).join('\n\n') }],
      toolName: 'surface_themes',
      toolDescription: 'List recurring themes across the journal entries.',
      inputSchema: THEMES_TOOL_SCHEMA,
      maxTokens: 500,
    }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setThemesStatus('error')
        return
      }
      setThemes(result.data.themes.filter((t) => t.occurrences > 1))
      setThemesStatus('idle')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the entry set identity changes
  }, [analysisAllowed, entries.length])

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Journal Insights</h2>

      {!configured && <p className="text-sm text-slate-500 dark:text-slate-400">Add your Claude API key in Settings to enable this.</p>}

      {configured && !settings.journalAnalysisEnabled && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Journal analysis is off — enable "Analyze my journal" in Settings → AI to see coaching and themes here.
        </p>
      )}

      {analysisAllowed && (
        <>
          <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10">
            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">✨ Coach</p>
            {coachStatus === 'loading' && <div className="h-4 w-2/3 rounded bg-indigo-100 dark:bg-indigo-500/20 animate-pulse" />}
            {coachStatus === 'not-enough' && <p className="text-xs text-slate-500 dark:text-slate-400">Not enough history yet</p>}
            {coachStatus === 'error' && <p className="text-xs text-slate-500 dark:text-slate-400">Coach message unavailable right now.</p>}
            {coachMessage && coachStatus === 'idle' && <p className="text-xs text-slate-700 dark:text-slate-300">{coachMessage}</p>}
          </div>

          <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <p className="text-xs font-semibold mb-1.5">Recurring themes</p>
            {themesStatus === 'loading' && (
              <div className="space-y-1.5">
                <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-700 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-700 animate-pulse" />
              </div>
            )}
            {themesStatus === 'not-enough' && <p className="text-xs text-slate-500 dark:text-slate-400">Not enough history yet</p>}
            {themesStatus === 'error' && <p className="text-xs text-slate-500 dark:text-slate-400">Themes unavailable right now.</p>}
            {themes && themesStatus === 'idle' && themes.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">No recurring themes yet.</p>
            )}
            {themes && themesStatus === 'idle' && themes.length > 0 && (
              <ul className="space-y-1">
                {themes.map((t, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300">
                    "{t.theme}" — mentioned {t.occurrences} times
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
            <p className="font-medium text-slate-500 dark:text-slate-400 mb-0.5">{e.date}</p>
            <p>{e.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
