import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DailyTracker from './pages/DailyTracker'
import Goals from './pages/Goals'
import Settings from './pages/Settings'
import { todayKey } from './lib/date'
import { useSettings } from './context/SettingsContext'

const Stats = lazy(() => import('./pages/Stats'))
const Calendar = lazy(() => import('./pages/Calendar'))

function Root() {
  const { settings } = useSettings()
  return <Navigate to={settings.defaultView === 'week' ? '/stats' : `/day/${todayKey()}`} replace />
}

export default function App() {
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
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Root />} />
      </Route>
    </Routes>
  )
}
