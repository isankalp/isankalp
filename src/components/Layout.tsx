import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { todayKey } from '../lib/date'
import { useT } from '../lib/i18n'
import clsx from 'clsx'
import AuthHeaderControl from './AuthHeaderControl'
import BadgeToast from './BadgeToast'
import KeyboardShortcuts from './KeyboardShortcuts'
import ProfileSwitcher from './ProfileSwitcher'
import UndoBanner from './UndoBanner'
import UnverifiedEmailBanner from './UnverifiedEmailBanner'

const links = [
  { to: `/day/${todayKey()}`, label: 'Today', match: '/day' },
  { to: '/calendar', label: 'Calendar', match: '/calendar' },
  { to: '/stats', label: 'Stats', match: '/stats' },
  { to: '/insights', label: 'Insights', match: '/insights' },
  { to: '/heatmap', label: 'Heatmap', match: '/heatmap' },
  { to: '/plan', label: 'Plan', match: '/plan' },
  { to: '/review', label: 'Review', match: '/review' },
  { to: '/goals', label: 'Goals', match: '/goals' },
  { to: '/badges', label: 'Badges', match: '/badges' },
  { to: '/settings', label: 'Settings', match: '/settings' },
]

export default function Layout() {
  const location = useLocation()
  const t = useT()
  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <h1 className="text-base font-bold tracking-tight">{t('Goals Tracker')}</h1>
          <nav className="flex gap-1 overflow-x-auto">
            {links.map((link) => (
              <NavLink
                key={link.match}
                to={link.to}
                className={({ isActive }) =>
                  clsx(
                    'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    (link.match === '/day' ? isActive || location.pathname.startsWith('/day') : isActive)
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800',
                  )
                }
              >
                {t(link.label)}
              </NavLink>
            ))}
          </nav>
          <ProfileSwitcher />
          <AuthHeaderControl />
        </div>
      </header>
      <UnverifiedEmailBanner />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 text-sm">
        <Outlet />
      </main>
      <BadgeToast />
      <UndoBanner />
      <KeyboardShortcuts />
    </div>
  )
}
