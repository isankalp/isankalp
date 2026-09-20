import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import OnboardingWizard from './components/OnboardingWizard'
import DailyTracker from './pages/DailyTracker'
import Goals from './pages/Goals'
import ResetPassword from './pages/ResetPassword'
import Settings from './pages/Settings'
import DataMigrationPrompt from './components/DataMigrationPrompt'
import { useAuth } from './context/AuthContext'
import { todayKey } from './lib/date'
import { useSettings } from './context/SettingsContext'
import { ensureRecurringTasksGenerated } from './lib/recurrence'
import { checkAndAwardBadges } from './lib/badges'
import { checkReminders } from './lib/reminders'
import { hasOnboarded } from './lib/onboarding'
import { checkAutoBackup } from './lib/autoBackup'
import { flushWebhookQueue } from './lib/webhookQueue'
import { useSpotifyPlayer } from './context/SpotifyPlayerContext'

const Stats = lazy(() => import('./pages/Stats'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Review = lazy(() => import('./pages/Review'))
const Badges = lazy(() => import('./pages/Badges'))
const PlanningWizard = lazy(() => import('./pages/PlanningWizard'))
const Insights = lazy(() => import('./pages/Insights'))
const Heatmap = lazy(() => import('./pages/Heatmap'))
const TimeBlocking = lazy(() => import('./pages/TimeBlocking'))
const Ask = lazy(() => import('./pages/Ask'))
const JournalInsights = lazy(() => import('./pages/JournalInsights'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

function Root() {
  const { settings } = useSettings()
  if (settings.defaultView === 'dashboard') return <Navigate to="/dashboard" replace />
  return <Navigate to={settings.defaultView === 'week' ? '/stats' : `/day/${todayKey()}`} replace />
}

export default function App() {
  const { settings } = useSettings()
  const { user } = useAuth()
  const spotify = useSpotifyPlayer()
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded())

  useEffect(() => {
    ensureRecurringTasksGenerated()
    checkAndAwardBadges()
  }, [])

  // Epic 66: DND pairing — a ref (not an effect dependency) so play/pause doesn't restart this
  // interval, but the check still reads live state, not a stale closure from mount time.
  const spotifyPlayingRef = useRef(spotify.isPlaying)
  useEffect(() => {
    spotifyPlayingRef.current = spotify.isPlaying
  }, [spotify.isPlaying])

  useEffect(() => {
    function run() {
      if (settings.dndDuringFocusMusic && spotifyPlayingRef.current) return
      checkReminders(settings)
    }
    run()
    const id = setInterval(run, 60_000)
    return () => clearInterval(id)
  }, [settings])

  useEffect(() => {
    checkAutoBackup(settings)
    const id = setInterval(() => checkAutoBackup(settings), 60 * 60_000)
    return () => clearInterval(id)
  }, [settings])

  useEffect(() => {
    flushWebhookQueue()
    window.addEventListener('online', flushWebhookQueue)
    return () => window.removeEventListener('online', flushWebhookQueue)
  }, [])

  return (
    <>
      {showOnboarding && <OnboardingWizard onFinish={() => setShowOnboarding(false)} />}
      {user && <DataMigrationPrompt />}
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Root />} />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={null}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="/day/:date" element={<DailyTracker />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/timeblock/:date"
          element={
            <Suspense fallback={null}>
              <TimeBlocking />
            </Suspense>
          }
        />
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
        <Route
          path="/heatmap"
          element={
            <Suspense fallback={null}>
              <Heatmap />
            </Suspense>
          }
        />
        <Route
          path="/ask"
          element={
            <Suspense fallback={null}>
              <Ask />
            </Suspense>
          }
        />
        <Route
          path="/journal"
          element={
            <Suspense fallback={null}>
              <JournalInsights />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Root />} />
      </Route>
      </Routes>
    </>
  )
}
