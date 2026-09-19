import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isEditableTarget } from '../lib/keyboardShortcuts'

const SHORTCUT_GROUPS = [
  {
    screen: 'Day view',
    items: [
      { keys: 'N', action: 'Focus quick-add to create a new task' },
      { keys: '↑ / ↓', action: 'Move focus between task rows' },
      { keys: 'Enter', action: 'Increment completed subtasks on the focused row' },
    ],
  },
  {
    screen: 'Anywhere',
    items: [
      { keys: 'Ctrl / Cmd + Z', action: 'Undo the last change' },
      { keys: '?', action: 'Show this shortcut reference' },
    ],
  },
]

/** PU-1/2: global keyboard shortcuts for the day view plus a discoverable "?" reference overlay. */
export default function KeyboardShortcuts() {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const location = useLocation()
  const isDayView = location.pathname.startsWith('/day')

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return

      if (e.key === '?') {
        e.preventDefault()
        setOverlayOpen((v) => !v)
        return
      }
      if (overlayOpen) {
        if (e.key === 'Escape') setOverlayOpen(false)
        return
      }
      if (!isDayView) return

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        ;(document.querySelector('[aria-label="Quick add task"]') as HTMLElement | null)?.focus()
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-row]'))
        if (rows.length === 0) return
        e.preventDefault()
        const currentIndex = rows.indexOf(document.activeElement as HTMLElement)
        let nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1
        if (currentIndex === -1) nextIndex = 0
        nextIndex = Math.max(0, Math.min(nextIndex, rows.length - 1))
        rows[nextIndex]?.focus()
        return
      }

      if (e.key === 'Enter') {
        const active = document.activeElement
        if (active instanceof HTMLElement && active.hasAttribute('data-task-row')) {
          e.preventDefault()
          active.querySelector<HTMLButtonElement>('button[aria-label="Increment completed subtasks"]')?.click()
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [overlayOpen, isDayView])

  if (!overlayOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOverlayOpen(false)}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-sm mb-3">Keyboard Shortcuts</h3>
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.screen} className="mb-3 last:mb-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{g.screen}</p>
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item.keys} className="flex items-center justify-between gap-3 text-xs">
                  <span>{item.action}</span>
                  <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[11px]">{item.keys}</kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button type="button" onClick={() => setOverlayOpen(false)} className="mt-2 text-xs text-slate-500 dark:text-slate-400 underline">
          Close
        </button>
      </div>
    </div>
  )
}
