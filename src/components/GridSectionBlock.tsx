import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { GridCell, GridDensity, GridRow, GridSection } from '../db/models'
import { GRID_LABEL_WIDTH_PX, deleteGridSection, nextOrder } from '../lib/grid'
import GridRowLine from './GridRowLine'

interface GridSectionBlockProps {
  section: GridSection
  siblingSections: GridSection[]
  allRows: GridRow[]
  sections: GridSection[]
  cells: GridCell[]
  dateKeys: string[]
  today: string
  density: GridDensity
}

export default function GridSectionBlock({
  section,
  siblingSections,
  allRows,
  sections,
  cells,
  dateKeys,
  today,
  density,
}: GridSectionBlockProps) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(section.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingRow, setAddingRow] = useState(false)
  const [newRowTitle, setNewRowTitle] = useState('')

  const rowsInSection = allRows.filter((r) => r.sectionId === section.id).sort((a, b) => a.order - b.order)
  const index = siblingSections.findIndex((s) => s.id === section.id)

  async function saveTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== section.title) {
      await db.gridSections.update(section.id, { title: trimmed, updatedAt: Date.now() })
    }
    setEditing(false)
  }

  async function toggleCollapsed() {
    await db.gridSections.update(section.id, { collapsed: !section.collapsed })
  }

  async function move(direction: -1 | 1) {
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= siblingSections.length) return
    const other = siblingSections[swapWith]
    await db.gridSections.update(section.id, { order: other.order })
    await db.gridSections.update(other.id, { order: section.order })
  }

  async function handleDelete() {
    await deleteGridSection(section.id)
  }

  async function handleAddRow() {
    const trimmed = newRowTitle.trim()
    if (!trimmed) return
    const now = Date.now()
    await db.gridRows.add({ id: uuid(), sectionId: section.id, title: trimmed, order: nextOrder(rowsInSection), createdAt: now, updatedAt: now })
    setNewRowTitle('')
    setAddingRow(false)
  }

  return (
    <div className="border-b-2 border-slate-200 dark:border-slate-700 last:border-b-0">
      <div className="sticky left-0 z-10 w-fit flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/60">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={section.collapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
          className="text-slate-500 dark:text-slate-400 text-xs w-4"
        >
          {section.collapsed ? '▸' : '▾'}
        </button>

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
                setTitleDraft(section.title)
                setEditing(false)
              }
            }}
            maxLength={60}
            className="px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-700 text-xs font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(section.title)
              setEditing(true)
            }}
            className="text-xs font-semibold whitespace-nowrap"
          >
            {section.title}
          </button>
        )}

        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          {rowsInSection.length} row{rowsInSection.length === 1 ? '' : 's'}
        </span>

        <button
          type="button"
          onClick={() => move(-1)}
          disabled={index <= 0}
          aria-label={`Move section ${section.title} up`}
          className="px-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={index === -1 || index >= siblingSections.length - 1}
          aria-label={`Move section ${section.title} down`}
          className="px-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
        >
          ↓
        </button>

        <button
          type="button"
          onClick={() => setAddingRow(true)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 whitespace-nowrap"
        >
          + Row
        </button>

        {confirmDelete ? (
          <span className="flex items-center gap-1 text-[10px] whitespace-nowrap">
            <span className="text-slate-500 dark:text-slate-400">
              Delete "{section.title}" and its {rowsInSection.length} row{rowsInSection.length === 1 ? '' : 's'}?
            </span>
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
            aria-label={`Delete section ${section.title}`}
            className="text-slate-400 hover:text-red-600 text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {addingRow && (
        <div className="sticky left-0 z-10 w-fit flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900">
          <input
            autoFocus
            type="text"
            value={newRowTitle}
            onChange={(e) => setNewRowTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddRow()
              if (e.key === 'Escape') {
                setAddingRow(false)
                setNewRowTitle('')
              }
            }}
            placeholder="New row name"
            maxLength={60}
            className="px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-xs"
          />
          <button type="button" onClick={handleAddRow} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-medium">
            Add
          </button>
          <button type="button" onClick={() => setAddingRow(false)} className="text-[10px] text-slate-400">
            cancel
          </button>
        </div>
      )}

      {!section.collapsed &&
        (rowsInSection.length === 0 ? (
          <p className="sticky left-0 w-fit px-2 py-2 text-[11px] text-slate-400 dark:text-slate-500" style={{ maxWidth: GRID_LABEL_WIDTH_PX * 2 }}>
            No rows yet — add one above.
          </p>
        ) : (
          rowsInSection.map((row) => (
            <GridRowLine
              key={row.id}
              row={row}
              siblingRows={rowsInSection}
              allRows={allRows}
              sections={sections}
              cells={cells}
              dateKeys={dateKeys}
              today={today}
              density={density}
            />
          ))
        ))}
    </div>
  )
}
