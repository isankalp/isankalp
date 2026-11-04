import { useState } from 'react'
import { db, getOrCreateDay } from '../db/db'
import { useAiClient } from '../hooks/useAiClient'
import { bulkDelete, bulkDuplicate, bulkMove, bulkTag } from '../lib/bulkOps'
import { addDays, todayKey } from '../lib/date'
import type { Task } from '../db/models'

type CommandAction = 'move' | 'duplicate' | 'tag' | 'delete' | 'unsupported'

interface InterpretedCommand {
  action: CommandAction
  taskIds: string[]
  targetDate?: string
  tagLabel?: string
}

const COMMAND_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['move', 'duplicate', 'tag', 'delete', 'unsupported'] },
    taskIds: { type: 'array', items: { type: 'string' }, description: 'ids of the matching tasks, from the provided list only' },
    targetDate: { type: 'string', description: 'YYYY-MM-DD, required for move/duplicate, resolved against the given "today" date' },
    tagLabel: { type: 'string', description: 'Required for the tag action — the label to apply' },
  },
  required: ['action', 'taskIds'],
}

const UNSUPPORTED_MESSAGE = "I can't do that yet — try move, duplicate, tag, or delete"
const CATEGORY_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#a855f7']

/** Epic 56 QC-2/3/4: a free-form instruction is interpreted into one of exactly four supported
 *  actions and shown as a specific preview — nothing executes until the user confirms it. */
export default function CommandBar({ onClose }: { onClose: () => void }) {
  const { configured, structured } = useAiClient()
  const [text, setText] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ command: InterpretedCommand; tasks: Task[] } | null>(null)
  const [executing, setExecuting] = useState(false)

  if (!configured) return null

  async function handleInterpret() {
    if (!text.trim()) return
    setInterpreting(true)
    setError(null)
    setPreview(null)

    const today = todayKey()
    const start = addDays(today, -60)
    const end = addDays(today, 60)
    const days = await db.days.where('date').between(start, end, true, true).toArray()
    const dayById = new Map(days.map((d) => [d.id, d.date]))
    const dayIds = days.map((d) => d.id)
    const candidates = dayIds.length ? await db.tasks.where('dayId').anyOf(dayIds).toArray() : []
    const candidateList = candidates
      .map((c) => `${c.id} | "${c.title}" | ${dayById.get(c.dayId)} | ${c.category?.label ?? 'untagged'}`)
      .join('\n')

    const result = await structured<InterpretedCommand>({
      system: `Today's date is ${today}. Interpret the user's free-form instruction against this list of their tasks (id | title | date | tag):\n${candidateList}\n\nSupported actions are exactly: move (change date), duplicate (copy to another date), tag (apply a label), delete. Pick taskIds only from the ids listed above — never invent one. Resolve relative dates ("this week", "tomorrow") against today's date. If the instruction doesn't fit one of the four actions, or matches no tasks, set action to "unsupported".`,
      messages: [{ role: 'user', content: text }],
      toolName: 'interpret_command',
      toolDescription: 'Interpret a free-form bulk task command into a specific, executable action.',
      inputSchema: COMMAND_TOOL_SCHEMA,
    })
    setInterpreting(false)

    if (!result.ok) {
      setError(result.error.message)
      return
    }
    const command = result.data
    if (command.action === 'unsupported' || command.taskIds.length === 0) {
      setError(UNSUPPORTED_MESSAGE)
      return
    }
    const matchedIds = new Set(candidates.map((c) => c.id))
    const tasks = candidates.filter((c) => command.taskIds.includes(c.id) && matchedIds.has(c.id))
    if (tasks.length === 0) {
      setError(UNSUPPORTED_MESSAGE)
      return
    }
    setPreview({ command, tasks })
  }

  async function handleConfirm() {
    if (!preview) return
    setExecuting(true)
    const { command, tasks } = preview
    try {
      if (command.action === 'move' && command.targetDate) {
        await bulkMove(
          tasks.map((t) => t.id),
          command.targetDate,
        )
      } else if (command.action === 'duplicate' && command.targetDate) {
        await getOrCreateDay(command.targetDate)
        await bulkDuplicate(tasks, command.targetDate)
      } else if (command.action === 'tag' && command.tagLabel) {
        const existing = tasks.find((t) => t.category?.label === command.tagLabel)?.category
        const color = existing?.color ?? CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]
        const icon = existing?.icon ?? '🏷️'
        await bulkTag(
          tasks.map((t) => t.id),
          { label: command.tagLabel, color, icon },
        )
      } else if (command.action === 'delete') {
        await bulkDelete(tasks)
      }
      setText('')
      setPreview(null)
      onClose()
    } finally {
      setExecuting(false)
    }
  }

  const actionLabel: Record<CommandAction, string> = {
    move: `Move to ${preview?.command.targetDate ?? '?'}`,
    duplicate: `Duplicate to ${preview?.command.targetDate ?? '?'}`,
    tag: `Tag "${preview?.command.tagLabel ?? ''}"`,
    delete: 'Delete',
    unsupported: '',
  }

  return (
    <div className="mt-1.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
            setPreview(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleInterpret()}
          placeholder='e.g. "move all my reading tasks this week to Friday"'
          aria-label="Command"
          className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent focus:outline-none border border-slate-200 dark:border-slate-600 rounded-md"
        />
        <button
          type="button"
          onClick={handleInterpret}
          disabled={interpreting || !text.trim()}
          className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {interpreting && <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
          Interpret
        </button>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs px-1">
          ✕
        </button>
      </div>

      {error && <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>}

      {preview && (
        <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-700 text-xs space-y-1.5">
          <p className="font-medium">
            {actionLabel[preview.command.action]} — {preview.tasks.length} task{preview.tasks.length === 1 ? '' : 's'}
          </p>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {preview.tasks.map((t) => (
              <li key={t.id} className="text-slate-600 dark:text-slate-300">
                {t.title}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={executing}
              className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
