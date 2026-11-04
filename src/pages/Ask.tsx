import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { useAiClient } from '../hooks/useAiClient'
import { useSettings } from '../context/SettingsContext'
import { dayMinutesDone, dayMinutesPlanned, isTaskComplete, type JournalEntry, type Task } from '../db/models'
import type { ClaudeMessage } from '../lib/claudeClient'

interface Citation {
  date: string
  note: string
}

interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
  errored?: boolean
}

const ANSWER_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    dataAvailable: { type: 'boolean', description: 'False if the requested information genuinely is not in the history provided' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, note: { type: 'string' } },
        required: ['date', 'note'],
      },
    },
  },
  required: ['answer', 'dataAvailable', 'citations'],
}

const EXAMPLE_PROMPTS = [
  'When did I last read this much in a week?',
  'How many days did I complete every task this month?',
  'What was my longest streak this year?',
]

/** Epic 55: QA-1..5. Every answer is generated from a history summary built here — Claude never sees
 *  anything beyond what's assembled below, so QA-3's "no fabrication" rule is enforced by scope, not
 *  just instruction. */
export default function Ask() {
  const { configured, structured } = useAiClient()
  const { settings } = useSettings()
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const journalEntries =
    useLiveQuery<JournalEntry[]>(
      () => (settings.journalAnalysisEnabled ? db.journalEntries.toArray() : Promise.resolve([])),
      [settings.journalAnalysisEnabled],
    ) ?? []

  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  if (!configured) return null

  function buildHistorySummary(): string {
    const tasksByDayId = new Map<string, Task[]>()
    for (const task of allTasks) {
      const list = tasksByDayId.get(task.dayId) ?? []
      list.push(task)
      tasksByDayId.set(task.dayId, list)
    }
    const journalByDate = new Map(journalEntries.map((j) => [j.date, j.text]))
    const lines = [...days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-365)
      .map((day) => {
        const dayTasks = tasksByDayId.get(day.id) ?? []
        if (dayTasks.length === 0 && !journalByDate.has(day.date)) return null
        const planned = dayMinutesPlanned(dayTasks)
        const done = dayMinutesDone(dayTasks)
        const completedTitles = dayTasks.filter(isTaskComplete).map((t) => t.title)
        const journal = journalByDate.get(day.date)
        return `${day.date}: ${done}/${planned} min done. Completed: [${completedTitles.join(', ') || 'none'}].${journal ? ` Journal: "${journal}"` : ''}`
      })
      .filter((line): line is string => line !== null)
    return lines.join('\n')
  }

  async function handleSubmit() {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', text: question }]
    setTurns(nextTurns)
    setLoading(true)

    const history = buildHistorySummary()
    const conversation: ClaudeMessage[] = nextTurns
      .filter((t) => !t.errored)
      .map((t) => ({ role: t.role, content: t.text }))

    const result = await structured<{ answer: string; dataAvailable: boolean; citations: Citation[] }>({
      system: `The user's own logged history (date: minutes done/planned, completed tasks, journal notes):\n${history || '(no history yet)'}\n\nAnswer only using this data. If the answer isn't determinable from it, set dataAvailable to false and say so in the answer rather than guessing. Cite the specific dates you drew from.`,
      messages: conversation,
      toolName: 'answer_question',
      toolDescription: "Answer the user's question about their own history, grounded only in the provided data.",
      inputSchema: ANSWER_TOOL_SCHEMA,
      maxTokens: 600,
    })
    setLoading(false)

    if (!result.ok) {
      setTurns((prev) => [...prev, { role: 'assistant', text: "Couldn't process that — try again", errored: true }])
      return
    }
    setTurns((prev) => [...prev, { role: 'assistant', text: result.data.answer, citations: result.data.citations }])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <h2 className="text-lg font-bold mb-3">Ask AI</h2>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {turns.length === 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Ask something about your own history, e.g.:</p>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInput(p)}
                className="block w-full text-left text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`text-xs p-2.5 rounded-lg max-w-[85%] ${turn.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
            <p>{turn.text}</p>
            {turn.citations && turn.citations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {turn.citations.map((c, j) => (
                  <Link
                    key={j}
                    to={`/day/${c.date}`}
                    title={c.note}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:underline"
                  >
                    {c.date}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-xs p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-[85%] text-slate-400">
            typing…
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Ask about your history…"
          aria-label="Ask a question"
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </div>
  )
}
