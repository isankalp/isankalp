import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import HabitWidget from '../components/HabitWidget'
import LifestyleModal from '../components/LifestyleModal'
import { useSettings } from '../context/SettingsContext'
import {
  DASHBOARD_WIDGET_IDS,
  dayAggregatePercent,
  isTaskComplete,
  minutesDone as taskMinutesDone,
  totalMinutes as taskTotalMinutes,
  type DashboardWidgetId,
  type Goal,
  type Task,
} from '../db/models'
import { lifestyleDayState } from '../lib/lifestyle'
import { completedDateKeys, currentStreak } from '../lib/streaks'
import { todayKey } from '../lib/date'

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  goals: 'Goals',
  habits: 'Habits',
  lifestyle: 'Lifestyle',
}

function GoalsWidget() {
  const navigate = useNavigate()
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const active = goals.filter((g) => !g.archivedAt).slice(0, 3)

  function progressFor(goal: Goal) {
    const tasks = allTasks.filter((t) => goal.linkedTaskTitles.includes(t.title))
    const planned = tasks.reduce((sum, t) => sum + taskTotalMinutes(t), 0)
    const done = tasks.reduce((sum, t) => sum + taskMinutesDone(t), 0)
    return planned > 0 ? Math.round((done / planned) * 100) : 0
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Goals</h3>
        <button type="button" onClick={() => navigate('/goals')} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
          View
        </button>
      </div>
      {active.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No active goals yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {active.map((g) => (
            <li key={g.id} className="text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="truncate">{g.title}</span>
                <span className="text-slate-400 shrink-0 ml-2">{progressFor(g)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, progressFor(g))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HabitsWidget() {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Habits</h3>
        <button type="button" onClick={() => navigate(`/day/${todayKey()}`)} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
          View
        </button>
      </div>
      <HabitWidget date={todayKey()} />
    </div>
  )
}

function LifestyleWidget({ onOpen }: { onOpen: () => void }) {
  const today = todayKey()
  const fields = useLiveQuery(() => db.lifestyleFields.toArray(), []) ?? []
  const activeFieldIds = fields.filter((f) => !f.archivedAt).map((f) => f.id)
  const todayEntries = useLiveQuery(() => db.lifestyleEntries.where('date').equals(today).toArray(), [today]) ?? []
  const state = lifestyleDayState(todayEntries, activeFieldIds)
  const stateLabel = state === 'pass' ? 'All targets met today' : state === 'fail' ? 'Needs attention today' : 'No entry yet today'
  const stateColor =
    state === 'pass'
      ? 'text-emerald-600 dark:text-emerald-400'
      : state === 'fail'
        ? 'text-red-700 dark:text-red-400'
        : 'text-slate-500 dark:text-slate-400'

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Lifestyle</h3>
        <button type="button" onClick={onOpen} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
          Log
        </button>
      </div>
      {activeFieldIds.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No lifestyle fields configured yet.</p>
      ) : (
        <p className={`text-xs font-medium ${stateColor}`}>{stateLabel}</p>
      )}
    </div>
  )
}

const WIDGETS: Record<DashboardWidgetId, (props: { onOpenLifestyle: () => void }) => React.JSX.Element> = {
  goals: GoalsWidget,
  habits: HabitsWidget,
  lifestyle: ({ onOpenLifestyle }) => <LifestyleWidget onOpen={onOpenLifestyle} />,
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useSettings()
  const [customizing, setCustomizing] = useState(false)
  const [lifestyleOpen, setLifestyleOpen] = useState(false)
  const today = todayKey()

  const day = useLiveQuery(() => db.days.where('date').equals(today).first(), [today])
  const tasks =
    useLiveQuery(async () => (day ? db.tasks.where('dayId').equals(day.id).toArray() : []), [day?.id]) ?? []
  const days = useLiveQuery(() => db.days.toArray(), []) ?? []
  const allTasksForStreak = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const everHadAnyTask = useLiveQuery(() => db.tasks.count(), []) ?? 0
  const everHadAnyGoal = useLiveQuery(() => db.goals.count(), []) ?? 0

  // DP-1/DP-4/DP-5: unit-agnostic aggregate percent, not the old minutes-weighted dayPercentComplete.
  const aggregatePercent = dayAggregatePercent(tasks)
  const completedSubtasksToday = tasks.reduce((s, t) => s + t.completedSubtasks, 0)
  const totalSubtasksToday = tasks.reduce((s, t) => s + t.totalSubtasks, 0)
  const remaining = tasks.filter((t) => !isTaskComplete(t)).length
  const streak = currentStreak(completedDateKeys(days, allTasksForStreak))
  const pending = tasks.filter((t: Task) => !isTaskComplete(t)).slice(0, 5)

  // Epic 67 shipped with only goals/habits; this folds in any widget id (like lifestyle) added
  // since, so an existing account's saved order still picks up new widgets instead of hiding them.
  const widgetOrder = [
    ...settings.dashboardWidgetOrder,
    ...DASHBOARD_WIDGET_IDS.filter((id) => !settings.dashboardWidgetOrder.includes(id)),
  ]

  function openTask(taskId: string) {
    navigate(`/day/${today}?task=${taskId}`)
  }

  function moveWidget(id: DashboardWidgetId, direction: -1 | 1) {
    const order = [...widgetOrder]
    const index = order.indexOf(id)
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= order.length) return
    ;[order[index], order[swapWith]] = [order[swapWith], order[index]]
    updateSettings({ dashboardWidgetOrder: order })
  }

  function toggleHidden(id: DashboardWidgetId) {
    const hidden = settings.dashboardHiddenWidgets.includes(id)
      ? settings.dashboardHiddenWidgets.filter((w) => w !== id)
      : [...settings.dashboardHiddenWidgets, id]
    updateSettings({ dashboardHiddenWidgets: hidden })
  }

  // DB-8: a brand-new account with genuinely nothing yet — the onboarding wizard already handles
  // first-run guidance, so this only covers the case where onboarding was skipped/dismissed early.
  if (everHadAnyTask === 0 && everHadAnyGoal === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-bold mb-2">Welcome to Goals Tracker</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add your first task or goal to get started.</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/day/${today}?focus=add`)}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
          >
            Add Task
          </button>
          <button
            type="button"
            onClick={() => navigate('/goals')}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Add Goal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Dashboard</h2>
        <button
          type="button"
          onClick={() => setCustomizing((v) => !v)}
          className="text-[11px] px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {customizing ? 'Done' : 'Customize'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
          <p className="text-lg font-bold">{aggregatePercent === null ? '–' : `${aggregatePercent}%`}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {totalSubtasksToday > 0 ? `${completedSubtasksToday}/${totalSubtasksToday} subtasks today` : 'No tasks today'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{streak}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Day streak</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
          <p className="text-lg font-bold">{remaining}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Tasks remaining</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/day/${today}?focus=add`)}
        className="w-full mb-4 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
      >
        + Add Task
      </button>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-sm font-semibold">Today</h3>
          <button type="button" onClick={() => navigate(`/day/${today}`)} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
            View all
          </button>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Nothing pending — nice work.</p>
        ) : (
          <ul className="space-y-1">
            {pending.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openTask(t.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        {widgetOrder.map((id) => {
          if (!customizing && settings.dashboardHiddenWidgets.includes(id)) return null
          const Widget = WIDGETS[id]
          return (
            <div key={id} className="relative">
              {customizing && (
                <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                  <span className="font-medium">{WIDGET_LABELS[id]}</span>
                  <button type="button" onClick={() => moveWidget(id, -1)} className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveWidget(id, 1)} className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHidden(id)}
                    className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600"
                  >
                    {settings.dashboardHiddenWidgets.includes(id) ? 'Show' : 'Hide'}
                  </button>
                </div>
              )}
              {(!customizing || !settings.dashboardHiddenWidgets.includes(id)) && (
                <Widget onOpenLifestyle={() => setLifestyleOpen(true)} />
              )}
              {customizing && settings.dashboardHiddenWidgets.includes(id) && (
                <p className="text-[11px] text-slate-400 italic">Hidden</p>
              )}
            </div>
          )
        })}
      </div>
      {lifestyleOpen && <LifestyleModal onClose={() => setLifestyleOpen(false)} />}
    </div>
  )
}
