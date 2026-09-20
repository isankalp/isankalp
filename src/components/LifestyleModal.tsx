import { useState } from 'react'
import { createPortal } from 'react-dom'
import LifestyleEntryView from './LifestyleEntryView'
import LifestyleCalendarView from './LifestyleCalendarView'
import LifestyleFieldConfigView from './LifestyleFieldConfigView'
import { todayKey } from '../lib/date'

type View = 'entry' | 'calendar' | 'config'

// Epic 68/69/71: a single portal-based modal shell (see AuthModal's portal for why — this can be
// opened from the header, which uses backdrop-blur) that swaps between the daily entry form, the
// month calendar, and field configuration in place, so LE-7/LV-6's "without losing context" holds
// literally: it's the same modal, just different content.
export default function LifestyleModal({ initialDate, onClose }: { initialDate?: string; onClose: () => void }) {
  const [view, setView] = useState<View>('entry')
  const [date, setDate] = useState(initialDate ?? todayKey())
  const [dirty, setDirty] = useState(false)
  const [pendingView, setPendingView] = useState<View | null>(null)

  function requestView(target: View) {
    if (dirty) {
      setPendingView(target)
      return
    }
    setView(target)
  }

  function discardAndGo() {
    if (pendingView) setView(pendingView)
    setPendingView(null)
    setDirty(false)
  }

  const title = view === 'entry' ? 'Lifestyle' : view === 'calendar' ? 'Lifestyle Calendar' : 'Lifestyle Fields'

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {view !== 'entry' && (
              <button
                type="button"
                onClick={() => setView('entry')}
                aria-label="Back to entries"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ←
              </button>
            )}
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {view === 'entry' && (
              <>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setDirty(false)
                  }}
                  aria-label="Entry date"
                  className="text-xs px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => requestView('calendar')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => requestView('config')}
                  aria-label="Lifestyle field settings"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                >
                  ⚙
                </button>
              </>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">
              ✕
            </button>
          </div>
        </div>

        {pendingView && (
          <div className="mb-3 p-2.5 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10 text-xs flex items-center justify-between gap-2">
            <span>You have unsaved entries. Save before leaving?</span>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setPendingView(null)} className="underline font-medium">
                Go back and save
              </button>
              <button type="button" onClick={discardAndGo} className="text-slate-500 dark:text-slate-400">
                Discard and continue
              </button>
            </div>
          </div>
        )}

        {view === 'entry' && <LifestyleEntryView date={date} onDirtyChange={setDirty} />}
        {view === 'calendar' && (
          <LifestyleCalendarView
            onSelectDate={(d) => {
              setDate(d)
              setView('entry')
            }}
            onEditTargets={() => setView('config')}
          />
        )}
        {view === 'config' && <LifestyleFieldConfigView />}
      </div>
    </div>,
    document.body,
  )
}
