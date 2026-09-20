import { useRef, useState } from 'react'
import clsx from 'clsx'
import { db } from '../db/db'
import type { GridCell, GridDensity, GridRow, GridSection } from '../db/models'
import {
  GRID_COLUMN_WIDTH_PX,
  GRID_LABEL_WIDTH_PX,
  dateRangeBetween,
  deleteGridRow,
  gridColumnWidthClass,
  isDuplicateRowNameInSection,
  nextOrder,
  rowCompletedDateKeys,
  rowCompletionCount,
  rowCurrentStreak,
  setGridCellRange,
  toggleGridCell,
} from '../lib/grid'

interface GridRowLineProps {
  row: GridRow
  siblingRows: GridRow[]
  allRows: GridRow[]
  sections: GridSection[]
  cells: GridCell[]
  dateKeys: string[]
  today: string
  density: GridDensity
}

export default function GridRowLine({ row, siblingRows, allRows, sections, cells, dateKeys, today, density }: GridRowLineProps) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(row.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lastClickRef = useRef<string | null>(null)

  const checkedDates = rowCompletedDateKeys(cells, row.id)
  const streak = rowCurrentStreak(cells, row.id)
  const { completed } = rowCompletionCount(cells, row.id, 30)
  const duplicate = isDuplicateRowNameInSection(row.title, allRows, row.sectionId, row.id)
  const index = siblingRows.findIndex((r) => r.id === row.id)

  async function saveTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== row.title) {
      await db.gridRows.update(row.id, { title: trimmed, updatedAt: Date.now() })
    }
    setEditing(false)
  }

  async function handleDelete() {
    await deleteGridRow(row.id)
  }

  async function move(direction: -1 | 1) {
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= siblingRows.length) return
    const other = siblingRows[swapWith]
    await db.gridRows.update(row.id, { order: other.order })
    await db.gridRows.update(other.id, { order: row.order })
  }

  async function moveToSection(sectionId: string) {
    if (sectionId === row.sectionId) return
    const targetSiblings = allRows.filter((r) => r.sectionId === sectionId)
    await db.gridRows.update(row.id, { sectionId, order: nextOrder(targetSiblings), updatedAt: Date.now() })
  }

  async function handleCellClick(date: string, shiftKey: boolean) {
    if (shiftKey && lastClickRef.current) {
      const range = dateRangeBetween(lastClickRef.current, date)
      const checked = !checkedDates.has(date)
      await setGridCellRange(row.id, range, checked)
    } else {
      await toggleGridCell(row.id, date)
    }
    lastClickRef.current = date
  }

  const colWidthClass = gridColumnWidthClass(density)
  const colWidthPx = GRID_COLUMN_WIDTH_PX[density]

  return (
    <div className="flex border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div
        className="sticky left-0 z-10 shrink-0 bg-white dark:bg-slate-900 px-2 py-1.5 flex items-center gap-1 border-r border-slate-200 dark:border-slate-700"
        style={{ width: GRID_LABEL_WIDTH_PX }}
      >
        {editing ? (
          <input
            autoFocus
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') {
                setTitleDraft(row.title)
                setEditing(false)
              }
            }}
            maxLength={60}
            className="min-w-0 flex-1 px-1 py-0.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(row.title)
              setEditing(true)
            }}
            className="min-w-0 flex-1 text-left text-xs truncate"
            title={row.title}
          >
            {row.title}
          </button>
        )}
        {duplicate && (
          <span title="Another row in this section has the same name" className="text-amber-500 shrink-0 text-xs">
            ⚠
          </span>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-0.5 px-1 border-r border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={index <= 0}
          aria-label={`Move ${row.title} up`}
          className="px-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={index === -1 || index >= siblingRows.length - 1}
          aria-label={`Move ${row.title} down`}
          className="px-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
        >
          ↓
        </button>
        {sections.length > 1 && (
          <select
            value={row.sectionId}
            onChange={(e) => moveToSection(e.target.value)}
            aria-label={`Move ${row.title} to a different section`}
            className="text-[10px] px-0.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 max-w-[70px]"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        <span className="text-[10px] text-slate-400 whitespace-nowrap px-1" title="Current streak / completions in the last 30 days">
          {streak > 0 ? `🔥${streak}` : `${completed}/30`}
        </span>
        {confirmDelete ? (
          <span className="flex items-center gap-0.5 text-[10px]">
            <button type="button" onClick={handleDelete} className="underline font-medium text-red-600 dark:text-red-400">
              Confirm
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-slate-400">
              cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete row ${row.title}`}
            className="text-slate-400 hover:text-red-600 text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {dateKeys.map((date) => {
        const checked = checkedDates.has(date)
        return (
          <button
            key={date}
            type="button"
            onClick={(e) => handleCellClick(date, e.shiftKey)}
            aria-label={`${row.title} on ${date}: ${checked ? 'completed' : 'not completed'}`}
            aria-pressed={checked}
            className={clsx(
              colWidthClass,
              'shrink-0 h-8 flex items-center justify-center border-r border-slate-100 dark:border-slate-800',
              date === today && 'bg-indigo-50/60 dark:bg-indigo-500/10',
            )}
            style={{ width: colWidthPx }}
          >
            <span
              className={clsx(
                'block rounded-sm',
                density === 'compact' ? 'w-4 h-4' : 'w-5 h-5',
                checked ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
