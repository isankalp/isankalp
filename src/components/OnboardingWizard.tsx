import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'
import { markOnboarded } from '../lib/onboarding'
import { todayKey } from '../lib/date'

type Step = 'intro' | 'goal' | 'task' | 'done'

export default function OnboardingWizard({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<Step>('intro')
  const [exampleMinutes, setExampleMinutes] = useState(5)
  const [exampleSubtasks, setExampleSubtasks] = useState(10)

  const [goalTitle, setGoalTitle] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [minutesPerSubtask, setMinutesPerSubtask] = useState('5')
  const [totalSubtasks, setTotalSubtasks] = useState('10')

  function skip() {
    markOnboarded()
    onFinish()
  }

  async function createGoalAndContinue() {
    if (goalTitle.trim()) {
      setTaskTitle(goalTitle.trim())
    }
    setStep('task')
  }

  async function createTaskAndFinish() {
    const minutes = Number(minutesPerSubtask)
    const total = Number(totalSubtasks)
    if (!taskTitle.trim() || !Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(total) || total <= 0) return

    if (goalTitle.trim()) {
      await db.goals.add({ id: uuid(), title: goalTitle.trim(), linkedTaskTitles: [taskTitle.trim()] })
    }
    const day = await getOrCreateDay(todayKey())
    const now = Date.now()
    await db.tasks.add({
      id: uuid(),
      title: taskTitle.trim(),
      dayId: day.id,
      minutesPerSubtask: minutes,
      totalSubtasks: Math.floor(total),
      completedSubtasks: 0,
      priority: 'Medium',
      createdAt: now,
      updatedAt: now,
    })
    setStep('done')
  }

  function finish() {
    markOnboarded()
    onFinish()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Welcome to Goals Tracker</h2>
          {step !== 'done' && (
            <button type="button" onClick={skip} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              Skip
            </button>
          )}
        </div>

        {step === 'intro' && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              Every task here is measured as <strong>minutes per subtask × total subtasks</strong>, so anything
              repeatable — pages, reps, questions — tracks consistently in time invested.
            </p>
            <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10">
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-2">Try it — drag the sliders:</p>
              <label className="block text-xs mb-1">
                {exampleMinutes} min per subtask
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={exampleMinutes}
                  onChange={(e) => setExampleMinutes(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="block text-xs mb-2">
                {exampleSubtasks} subtasks
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={exampleSubtasks}
                  onChange={(e) => setExampleSubtasks(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                = {exampleMinutes * exampleSubtasks} minutes total
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('goal')}
              className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Let's set up your first goal
            </button>
          </div>
        )}

        {step === 'goal' && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">What's something you want to make progress on?</p>
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Finish DSA prep"
              maxLength={120}
              className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
            />
            <button
              type="button"
              onClick={createGoalAndContinue}
              className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Next: add today's task
            </button>
          </div>
        )}

        {step === 'task' && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">Now let's add one task for today.</p>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task title"
              maxLength={120}
              className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
            />
            <div className="flex gap-2">
              <label className="text-xs flex-1">
                <span className="text-slate-500 dark:text-slate-400">Min/subtask</span>
                <input
                  type="number"
                  value={minutesPerSubtask}
                  onChange={(e) => setMinutesPerSubtask(e.target.value)}
                  min={0.1}
                  step="any"
                  className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </label>
              <label className="text-xs flex-1">
                <span className="text-slate-500 dark:text-slate-400">Total subtasks</span>
                <input
                  type="number"
                  value={totalSubtasks}
                  onChange={(e) => setTotalSubtasks(e.target.value)}
                  min={1}
                  step={1}
                  className="mt-0.5 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={createTaskAndFinish}
              disabled={!taskTitle.trim()}
              className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40"
            >
              Create and finish
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-3">
            <p className="text-2xl">🎉</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">You're all set. Your goal and today's task are ready.</p>
            <button type="button" onClick={finish} className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
              Go to Today
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
