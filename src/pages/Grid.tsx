import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import clsx from 'clsx'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/db'
import { useSettings } from '../context/SettingsContext'
import { addDays, todayKey } from '../lib/date'
import { GRID_COLUMN_WIDTH_PX, GRID_LABEL_WIDTH_PX, dateRangeBetween, gridColumnWidthClass, nextOrder } from '../lib/grid'
import GridSectionBlock from '../components/GridSectionBlock'

const PAGE_DAYS = 30
const LOAD_THRESHOLD_PX = 200

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatColumnHeader(date: string): { weekday: string; day: string } {
  const [, m, d] = date.split('-')
  const weekday = WEEKDAY_SHORT[new Date(`${date}T00:00:00`).getDay()]
  return { weekday, day: `${m}/${d}` }
}

export default function Grid() {
  const { settings, updateSettings } = useSettings()
  const sectionsRaw = useLiveQuery(() => db.gridSections.toArray(), [])
  const rowsRaw = useLiveQuery(() => db.gridRows.toArray(), [])
  const cellsRaw = useLiveQuery(() => db.gridCells.toArray(), [])
  const loading = sectionsRaw === undefined || rowsRaw === undefined || cellsRaw === undefined
  const sections = sectionsRaw ?? []
  const rows = rowsRaw ?? []
  const cells = cellsRaw ?? []

  const today = todayKey()
  const anchor = settings.gridScrollAnchorDate || today
  const [rangeStart, setRangeStart] = useState(() => addDays(anchor, -PAGE_DAYS))
  const [rangeEnd, setRangeEnd] = useState(() => addDays(anchor, PAGE_DAYS))
  const dateKeys = useMemo(() => dateRangeBetween(rangeStart, rangeEnd), [rangeStart, rangeEnd])

  const scrollRef = useRef<HTMLDivElement>(null)
  const dateColRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const prevScrollWidthRef = useRef<number | null>(null)
  const hasScrolledInitiallyRef = useRef(false)
  const scrollDebounceRef = useRef<number | undefined>(undefined)
  const [pendingJump, setPendingJump] = useState<string | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || prevScrollWidthRef.current === null) return
    el.scrollLeft += el.scrollWidth - prevScrollWidthRef.current
    prevScrollWidthRef.current = null
  }, [rangeStart])

  useEffect(() => {
    if (hasScrolledInitiallyRef.current || loading) return
    const el = dateColRefs.current[anchor]
    if (el) {
      el.scrollIntoView({ inline: 'start', block: 'nearest' })
      hasScrolledInitiallyRef.current = true
    }
  })

  useEffect(() => {
    if (!pendingJump) return
    const el = dateColRefs.current[pendingJump]
    if (el) {
      el.scrollIntoView({ inline: 'center', block: 'nearest' })
      void updateSettings({ gridScrollAnchorDate: pendingJump })
      setPendingJump(null)
    }
  })

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft < LOAD_THRESHOLD_PX) {
      prevScrollWidthRef.current = el.scrollWidth
      setRangeStart((s) => addDays(s, -PAGE_DAYS))
    }
    if (el.scrollWidth - el.scrollLeft - el.clientWidth < LOAD_THRESHOLD_PX) {
      setRangeEnd((e) => addDays(e, PAGE_DAYS))
    }

    const colWidthPx = GRID_COLUMN_WIDTH_PX[settings.gridDensity]
    window.clearTimeout(scrollDebounceRef.current)
    scrollDebounceRef.current = window.setTimeout(() => {
      const index = Math.max(0, Math.round(el.scrollLeft / colWidthPx))
      const date = dateKeys[Math.min(index, dateKeys.length - 1)]
      if (date && date !== settings.gridScrollAnchorDate) void updateSettings({ gridScrollAnchorDate: date })
    }, 500)
  }

  function jumpToDate(date: string) {
    if (!date) return
    if (date < rangeStart) setRangeStart(date)
    if (date > rangeEnd) setRangeEnd(date)
    setPendingJump(date)
  }

  async function handleAddSection() {
    const trimmed = newSectionTitle.trim()
    if (!trimmed) return
    const now = Date.now()
    await db.gridSections.add({ id: uuid(), title: trimmed, order: nextOrder(sections), collapsed: false, createdAt: now, updatedAt: now })
    setNewSectionTitle('')
    setAddingSection(false)
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-3">Grid</h2>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  const sortedSections = sections.slice().sort((a, b) => a.order - b.order)
  const visibleSections = settings.gridSectionFilter
    ? sortedSections.filter((s) => s.id === settings.gridSectionFilter)
    : sortedSections
  const colWidthClass = gridColumnWidthClass(settings.gridDensity)
  const colWidthPx = GRID_COLUMN_WIDTH_PX[settings.gridDensity]

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-lg font-bold">Grid</h2>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <select
            value={settings.gridSectionFilter}
            onChange={(e) => void updateSettings({ gridSectionFilter: e.target.value })}
            aria-label="Filter grid by section"
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
          >
            <option value="">All sections</option>
            {sortedSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Jump to date"
            onChange={(e) => jumpToDate(e.target.value)}
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
          />
          <div className="flex rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => void updateSettings({ gridDensity: 'compact' })}
              className={clsx('px-2 py-1', settings.gridDensity === 'compact' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800')}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => void updateSettings({ gridDensity: 'comfortable' })}
              className={clsx('px-2 py-1', settings.gridDensity === 'comfortable' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800')}
            >
              Comfortable
            </button>
          </div>
          {sortedSections.length > 0 &&
            (addingSection ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSection()
                    if (e.key === 'Escape') setAddingSection(false)
                  }}
                  placeholder="Section name"
                  maxLength={60}
                  className="px-2 py-1 rounded-md border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800"
                />
                <button type="button" onClick={handleAddSection} className="px-2 py-1 rounded-md bg-indigo-600 text-white font-medium">
                  Add
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAddingSection(true)}
                className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              >
                + Add Section
              </button>
            ))}
        </div>
      </div>

      {sortedSections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            No sections yet. Create your first section to start tracking habits and tasks day by day.
          </p>
          {addingSection ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <input
                autoFocus
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection()
                  if (e.key === 'Escape') setAddingSection(false)
                }}
                placeholder="e.g. Morning Routine"
                maxLength={60}
                className="px-2 py-1 rounded-md border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800"
              />
              <button type="button" onClick={handleAddSection} className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium">
                Add
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSection(true)}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
            >
              + Create your first section
            </button>
          )}
        </div>
      ) : (
        <div ref={scrollRef} onScroll={handleScroll} className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
          <div style={{ minWidth: 'max-content' }}>
            <div className="flex sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <div
                className="sticky left-0 z-30 shrink-0 bg-slate-50 dark:bg-slate-800/80"
                style={{ width: GRID_LABEL_WIDTH_PX + 90 }}
              />
              {dateKeys.map((date) => {
                const { weekday, day } = formatColumnHeader(date)
                return (
                  <div
                    key={date}
                    ref={(el) => {
                      dateColRefs.current[date] = el
                    }}
                    className={clsx(
                      colWidthClass,
                      'shrink-0 flex flex-col items-center justify-center py-1 text-[9px] leading-tight border-r border-slate-100 dark:border-slate-700',
                      date === today && 'bg-indigo-100 dark:bg-indigo-500/20 font-semibold text-indigo-700 dark:text-indigo-300',
                    )}
                    style={{ width: colWidthPx }}
                  >
                    <span>{weekday}</span>
                    <span>{day}</span>
                  </div>
                )
              })}
            </div>

            {visibleSections.map((section) => (
              <GridSectionBlock
                key={section.id}
                section={section}
                siblingSections={sortedSections}
                allRows={rows}
                sections={sortedSections}
                cells={cells}
                dateKeys={dateKeys}
                today={today}
                density={settings.gridDensity}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
