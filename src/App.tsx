import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DailyTracker from './pages/DailyTracker'
import Goals from './pages/Goals'
import Settings from './pages/Settings'
import { todayKey } from './lib/date'
import { useSettings } from './context/SettingsContext'
import { ensureRecurringTasksGenerated } from './lib/recurrence'
import { checkAndAwardBadges } from './lib/badges'
import { checkReminders } from './lib/reminders'

const Stats = lazy(() => import('./pages/Stats'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Review = lazy(() => import('./pages/Review'))
const Badges = lazy(() => import('./pages/Badges'))
const PlanningWizard = lazy(() => import('./pages/PlanningWizard'))
const Insights = lazy(() => import('./pages/Insights'))

function Root() {
  const { settings } = useSettings()
  return <Navigate to={settings.defaultView === 'week' ? '/stats' : `/day/${todayKey()}`} replace />
}

export default function App() {
  const { settings } = useSettings()

  useEffect(() => {
    ensureRecurringTasksGenerated()
    checkAndAwardBadges()
  }, [])

  useEffect(() => {
    checkReminders(settings)
    const id = setInterval(() => checkReminders(settings), 60_000)
    return () => clearInterval(id)
  }, [settings])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Root />} />
        <Route path="/day/:date" element={<DailyTracker />} />
        <Route path="/goals" element={<Goals />} />
        <Route
          path="/stats"
          element={
            <Suspense fallback={null}>
              <Stats />
            </Suspense>
          }
        />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={null}>
              <Calendar />
            </Suspense>
          }
        />
        <Route
          path="/review"
          element={
            <Suspense fallback={null}>
              <Review />
            </Suspense>
          }
        />
        <Route
          path="/badges"
          element={
            <Suspense fallback={null}>
              <Badges />
            </Suspense>
          }
        />
        <Route
          path="/plan"
          element={
            <Suspense fallback={null}>
              <PlanningWizard />
            </Suspense>
          }
        />
        <Route
          path="/insights"
          element={
            <Suspense fallback={null}>
              <Insights />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Root />} />
      </Route>
    </Routes>
  )
}
