import { useLiveQuery } from '../hooks/useLiveQuery'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import AIGoalBreakdown from '../components/AIGoalBreakdown'
import TemplateLibrary from '../components/TemplateLibrary'
import { useAiClient } from '../hooks/useAiClient'
import { minutesDone as taskMinutesDone, totalMinutes as taskTotalMinutes, type Goal } from '../db/models'

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

function GoalCard({ goal, allTaskTitles }: { goal: Goal; allTaskTitles: string[] }) {
  const tasks =
    useLiveQuery(
      () => db.tasks.where('title').anyOf(goal.linkedTaskTitles.length ? goal.linkedTaskTitles : ['__none__']).toArray(),
      [goal.linkedTaskTitles.join('|')],
    ) ?? []

  const planned = tasks.reduce((sum, t) => sum + taskTotalMinutes(t), 0)
  const done = tasks.reduce((sum, t) => sum + taskMinutesDone(t), 0)
  const percent = planned > 0 ? Math.round((done / planned) * 100) : 0
  const unmatched = goal.linkedTaskTitles.filter((t) => !allTaskTitles.includes(t))

  async function remove() {
    await db.goals.delete(goal.id)
  }

  async function toggleArchive() {
    await db.goals.update(goal.id, { archivedAt: goal.archivedAt ? undefined : Date.now() })
  }

  async function commitTitle(value: string) {
    const title = value.trim()
    if (!title || title === goal.title) return
    await db.goals.update(goal.id, { title })
  }

  async function commitTargetDate(value: string) {
    await db.goals.update(goal.id, { targetDate: value || undefined })
  }

  const fieldClass =
    'bg-transparent border-b border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-solid focus:border-indigo-500 focus:outline-none px-0.5 -mx-0.5'

  return (
    <li className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            defaultValue={goal.title}
            key={`${goal.id}-title`}
            onBlur={(e) => commitTitle(e.target.value)}
            onKeyDown={blurOnEnter}
            maxLength={120}
            aria-label="Goal title"
            className={`font-semibold text-sm w-full ${fieldClass}`}
          />
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Target:</span>
            <input
              type="date"
              defaultValue={goal.targetDate ?? ''}
              key={`${goal.id}-target`}
              onChange={(e) => commitTargetDate(e.target.value)}
              aria-label="Target date"
              className={fieldClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={toggleArchive}
            aria-label={goal.archivedAt ? `Unarchive ${goal.title}` : `Archive ${goal.title}`}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {goal.archivedAt ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            onClick={remove}
            className="text-slate-400 hover:text-red-600 text-xs"
            aria-label={`Delete goal ${goal.title}`}
          >
            ✕
          </button>
        </div>
      </div>

      {goal.linkedTaskTitles.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs font-medium tabular-nums w-9 text-right">{percent}%</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {done} / {planned} min across {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {goal.linkedTaskTitles.map((t) => (
              <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                {t}
              </span>
            ))}
          </div>
          {unmatched.length > 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              No tasks logged yet for: {unmatched.join(', ')}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
          No linked task titles yet — link daily tasks by title to track progress toward this goal.
        </p>
      )}
    </li>
  )
}

export default function Goals() {
  const allGoals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const allTaskTitles = [...new Set(allTasks.map((t) => t.title))].sort()
  const { configured: aiConfigured } = useAiClient()

  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedTitles, setSelectedTitles] = useState<string[]>([])
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false)
  const [aiBreakdownOpen, setAiBreakdownOpen] = useState(false)

  const goals = allGoals.filter((g) => (tab === 'active' ? !g.archivedAt : !!g.archivedAt))

  function toggleTitle(t: string) {
    setSelectedTitles((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const goal: Goal = {
      id: uuid(),
      title: title.trim(),
      linkedTaskTitles: selectedTitles,
      targetDate: targetDate || undefined,
    }
    await db.goals.add(goal)
    setTitle('')
    setTargetDate('')
    setSelectedTitles([])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-lg font-bold">Goals</h2>
        <div className="flex items-center gap-2">
          {aiConfigured && (
            <button
              type="button"
              onClick={() => setAiBreakdownOpen(true)}
              className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              ✨ Break Down with AI
            </button>
          )}
          <button
            type="button"
            onClick={() => setTemplateLibraryOpen(true)}
            className="text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            New Goal from Template
          </button>
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-700">
            {(['active', 'archived'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${
                  tab === t ? 'bg-white dark:bg-slate-900 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {templateLibraryOpen && <TemplateLibrary onClose={() => setTemplateLibraryOpen(false)} />}
      {aiBreakdownOpen && <AIGoalBreakdown onClose={() => setAiBreakdownOpen(false)} />}

      {tab === 'active' && (
        <form
        onSubmit={handleSubmit}
        className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2"
      >
        <div className="flex flex-col sm:flex-row gap-1.5">
          <input
            type="text"
            placeholder="Goal title (e.g. Finish DSA prep)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className="flex-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 whitespace-nowrap"
          >
            Add Goal
          </button>
        </div>

        {allTaskTitles.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Link task titles to roll up progress (optional):
            </p>
            <div className="flex flex-wrap gap-1">
              {allTaskTitles.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTitle(t)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    selectedTitles.includes(t)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        </form>
      )}

      {goals.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
          {tab === 'active' ? 'No goals yet. Add one above to start rolling up progress across days.' : 'No archived goals.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} allTaskTitles={allTaskTitles} />
          ))}
        </ul>
      )}
    </div>
  )
}
