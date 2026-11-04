import { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { todayKey } from '../lib/date'
import { checkFeasibility, historicalDailyPace } from '../lib/feasibility'
import { useAiClient } from '../hooks/useAiClient'
import type { ClaudeContentBlock } from '../lib/claudeClient'
import type { Task } from '../db/models'

interface ProposedTask {
  title: string
  minutesPerSubtask: number
  totalSubtasks: number
  date: string
}

const BREAKDOWN_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          minutesPerSubtask: { type: 'number' },
          totalSubtasks: { type: 'number' },
          date: { type: 'string', description: 'YYYY-MM-DD, when this task should be scheduled' },
        },
        required: ['title', 'minutesPerSubtask', 'totalSubtasks', 'date'],
      },
    },
  },
  required: ['tasks'],
}

const GENERATE_FAILED_MESSAGE = "Couldn't generate a breakdown — try again or enter tasks manually"

/** Epic 53: GB-1..6. Nothing is saved until "Create Selected Tasks" is pressed (GB-2); the feasibility
 *  banner (GB-4) is purely advisory and never blocks that button (GB-5). */
export default function AIGoalBreakdown({ onClose }: { onClose: () => void }) {
  const { structured } = useAiClient()
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileBlock, setFileBlock] = useState<ClaudeContentBlock | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<ProposedTask[] | null>(null)
  const [feasibility, setFeasibility] = useState<ReturnType<typeof checkFeasibility> | null>(null)
  const [feasibilityDismissed, setFeasibilityDismissed] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(file: File | null) {
    if (!file) {
      setFileName(null)
      setFileBlock(null)
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    const base64 = dataUrl.split(',')[1] ?? ''
    setFileName(file.name)
    setFileBlock({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
  }

  async function computeFeasibility(proposed: ProposedTask[]) {
    const today = todayKey()
    const start = new Date(today)
    start.setDate(start.getDate() - 30)
    const days = await db.days.where('date').between(start.toISOString().slice(0, 10), today, true, true).toArray()
    const dayIds = days.map((d) => d.id)
    const recentTasks = dayIds.length ? await db.tasks.where('dayId').anyOf(dayIds).toArray() : []
    const byDayId = new Map<string, Task[]>()
    for (const day of days) byDayId.set(day.id, [])
    for (const task of recentTasks) byDayId.get(task.dayId)?.push(task)
    const historicalDailyMinutes = historicalDailyPace(byDayId)

    const totalMinutes = proposed.reduce((sum, t) => sum + t.minutesPerSubtask * t.totalSubtasks, 0)
    const latestDate = proposed.reduce((latest, t) => (t.date > latest ? t.date : latest), today)
    const daysAvailable = Math.max(1, Math.round((new Date(latestDate).getTime() - new Date(today).getTime()) / 86_400_000))
    const check = checkFeasibility(totalMinutes, daysAvailable, historicalDailyMinutes)
    setFeasibility(check)
    setFeasibilityDismissed(false)
  }

  async function handleGenerate() {
    if (!description.trim() && !fileBlock) return
    setGenerating(true)
    setError(null)
    setTasks(null)
    const today = todayKey()
    const content: ClaudeContentBlock[] = fileBlock
      ? [fileBlock, { type: 'text', text: description.trim() || 'Break this document down into scheduled tasks.' }]
      : [{ type: 'text', text: description.trim() }]

    const result = await structured<{ tasks: ProposedTask[] }>({
      system: `Today's date is ${today}. Break the goal (or attached document) down into concrete, schedulable tasks with realistic minutesPerSubtask and totalSubtasks, each on a specific YYYY-MM-DD date on or after today.`,
      messages: [{ role: 'user', content }],
      toolName: 'propose_tasks',
      toolDescription: 'Propose a list of scheduled tasks that break down the goal.',
      inputSchema: BREAKDOWN_TOOL_SCHEMA,
      maxTokens: 4096,
    })
    setGenerating(false)
    if (!result.ok || result.data.tasks.length === 0) {
      setError(GENERATE_FAILED_MESSAGE)
      return
    }
    setTasks(result.data.tasks)
    await computeFeasibility(result.data.tasks)
  }

  function updateTask(index: number, patch: Partial<ProposedTask>) {
    setTasks((prev) => prev?.map((t, i) => (i === index ? { ...t, ...patch } : t)) ?? null)
  }

  function removeTask(index: number) {
    setTasks((prev) => prev?.filter((_, i) => i !== index) ?? null)
  }

  async function handleCreate() {
    if (!tasks || tasks.length === 0) return
    setCreating(true)
    const now = Date.now()
    const dayIdByDate = new Map<string, string>()
    for (const t of tasks) {
      if (!dayIdByDate.has(t.date)) {
        const day = await getOrCreateDay(t.date)
        dayIdByDate.set(t.date, day.id)
      }
    }
    await db.tasks.bulkAdd(
      tasks.map((t) => ({
        id: uuid(),
        title: t.title,
        dayId: dayIdByDate.get(t.date)!,
        minutesPerSubtask: t.minutesPerSubtask,
        totalSubtasks: Math.max(1, Math.floor(t.totalSubtasks)),
        completedSubtasks: 0,
        priority: 'Medium' as const,
        createdAt: now,
        updatedAt: now,
      })),
    )
    const latestDate = tasks.reduce((latest, t) => (t.date > latest ? t.date : latest), tasks[0].date)
    await db.goals.add({
      id: uuid(),
      title: description.trim().slice(0, 120) || fileName || 'AI-generated goal',
      linkedTaskTitles: [...new Set(tasks.map((t) => t.title))],
      targetDate: latestDate,
    })
    setCreating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Break Down with AI</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-sm">
            ✕
          </button>
        </div>

        {!tasks && (
          <div className="space-y-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Describe a goal, e.g. "prep a 20-min conference talk in 3 weeks"'
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs resize-none"
            />
            <div className="flex items-center gap-2 text-xs">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,text/plain"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                📎 {fileName ?? 'Upload syllabus / reading list (PDF)'}
              </button>
              {fileName && (
                <button type="button" onClick={() => handleFileChange(null)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || (!description.trim() && !fileBlock)}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generating && <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
              {generating ? 'Generating…' : 'Generate breakdown'}
            </button>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            {generating && (
              <div className="space-y-1.5 pt-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-6 rounded-md bg-slate-100 dark:bg-slate-700 animate-pulse" />
                ))}
              </div>
            )}
          </div>
        )}

        {tasks && (
          <div className="space-y-2">
            {feasibility?.overBudget && !feasibilityDismissed && (
              <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300 flex items-start justify-between gap-2">
                <span>
                  This needs ~{feasibility.percentOver}% more time per day ({Math.round(feasibility.requiredDailyMinutes)} min/day) than your
                  recent pace ({Math.round(feasibility.historicalDailyMinutes)} min/day) — advisory only, you can still create these tasks.
                </span>
                <button type="button" onClick={() => setFeasibilityDismissed(true)} className="shrink-0 text-amber-500 hover:text-amber-700">
                  ✕
                </button>
              </div>
            )}
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {tasks.map((t, i) => (
                <li key={i} className="flex items-center gap-1.5 p-1.5 rounded-md border border-slate-200 dark:border-slate-600 text-xs">
                  <input
                    type="text"
                    value={t.title}
                    onChange={(e) => updateTask(i, { title: e.target.value })}
                    className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                  <input
                    type="number"
                    value={t.minutesPerSubtask}
                    onChange={(e) => updateTask(i, { minutesPerSubtask: Number(e.target.value) })}
                    min={1}
                    className="w-16 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                    aria-label="Minutes per subtask"
                  />
                  <input
                    type="number"
                    value={t.totalSubtasks}
                    onChange={(e) => updateTask(i, { totalSubtasks: Number(e.target.value) })}
                    min={1}
                    className="w-14 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                    aria-label="Total subtasks"
                  />
                  <input
                    type="date"
                    value={t.date}
                    onChange={(e) => updateTask(i, { date: e.target.value })}
                    className="px-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                  <button type="button" onClick={() => removeTask(i)} aria-label="Remove task" className="text-slate-400 hover:text-red-600">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || tasks.length === 0}
                className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Create Selected Tasks
              </button>
              <button
                type="button"
                onClick={() => {
                  setTasks(null)
                  setFeasibility(null)
                }}
                className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
