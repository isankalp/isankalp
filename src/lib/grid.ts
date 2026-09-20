import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { GridCell, GridDensity, GridRow } from '../db/models'
import { addDays, todayKey } from './date'
import { currentStreak as streakFromDates } from './streaks'

/** Epic 78 (DC-1): the two supported column widths, shared by the date header and every row so
 *  they always line up. */
export function gridColumnWidthClass(density: GridDensity): string {
  return density === 'compact' ? 'w-7' : 'w-10'
}

export const GRID_COLUMN_WIDTH_PX: Record<GridDensity, number> = { compact: 28, comfortable: 40 }
export const GRID_LABEL_WIDTH_PX = 160
/** Width of the per-row controls strip (reorder/move/streak/delete) that sits pinned immediately
 *  after the label column. Must stay in sync with the header's corner spacer so date columns in
 *  the header line up exactly with the checkbox columns in every row. */
export const GRID_CONTROLS_WIDTH_PX = 168
export const GRID_PINNED_WIDTH_PX = GRID_LABEL_WIDTH_PX + GRID_CONTROLS_WIDTH_PX

/** Epic 78 (DR-1): inclusive list of date keys running from `daysBefore` days before `anchorDate`
 *  through `daysAfter` days after it, used to grow the grid's loaded column window as the user
 *  scrolls in either direction with no fixed boundary. */
export function buildDateRange(anchorDate: string, daysBefore: number, daysAfter: number): string[] {
  const dates: string[] = []
  for (let i = -daysBefore; i <= daysAfter; i++) {
    dates.push(addDays(anchorDate, i))
  }
  return dates
}

/** RM-6: duplicate row names within a section are allowed, never blocked — this only tells the UI
 *  whether to show the subtle warning icon next to a row. */
export function isDuplicateRowNameInSection(
  name: string,
  rows: GridRow[],
  sectionId: string,
  excludeId?: string,
): boolean {
  const trimmed = name.trim().toLowerCase()
  return rows.some((r) => r.sectionId === sectionId && r.id !== excludeId && r.title.trim().toLowerCase() === trimmed)
}

/** Next `order` value to append an item after every existing one in its list (sections, or rows
 *  within a section). */
export function nextOrder(items: { order: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.order)) + 1
}

/** The set of date keys a row has been checked off on, for streak/count math (Epic 77, CC-6). */
export function rowCompletedDateKeys(cells: GridCell[], rowId: string): Set<string> {
  const dates = new Set<string>()
  for (const cell of cells) {
    if (cell.rowId === rowId) dates.add(cell.date)
  }
  return dates
}

/** CC-6: current consecutive-day streak ending today (or yesterday, if today isn't checked yet). */
export function rowCurrentStreak(cells: GridCell[], rowId: string): number {
  return streakFromDates(rowCompletedDateKeys(cells, rowId))
}

/** CC-6: "N/window" completion count — e.g. windowDays=30 for "12/30 this month" — counted over the
 *  trailing `windowDays` days inclusive of today. */
export function rowCompletionCount(cells: GridCell[], rowId: string, windowDays: number): { completed: number; total: number } {
  const completedDates = rowCompletedDateKeys(cells, rowId)
  const today = todayKey()
  let completed = 0
  for (let i = 0; i < windowDays; i++) {
    if (completedDates.has(addDays(today, -i))) completed++
  }
  return { completed, total: windowDays }
}

/** CC-4: every date key in the inclusive range between two (possibly out-of-order) dates, for
 *  click-drag / shift-click bulk toggling. */
export function dateRangeBetween(dateA: string, dateB: string): string[] {
  const [start, end] = dateA <= dateB ? [dateA, dateB] : [dateB, dateA]
  const dates: string[] = []
  let cursor = start
  while (cursor <= end) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

/** CC-1/CC-2: flips one cell's checked state and persists immediately; returns the new state. */
export async function toggleGridCell(rowId: string, date: string): Promise<boolean> {
  const rowCells = await db.gridCells.where('rowId').equals(rowId).toArray()
  const existing = rowCells.find((c) => c.date === date)
  if (existing) {
    await db.gridCells.delete(existing.id)
    return false
  }
  await db.gridCells.add({ id: uuid(), rowId, date, createdAt: Date.now() })
  return true
}

/** CC-4: sets every date in `dates` to the same checked state in one go (bulk drag/shift-click). */
export async function setGridCellRange(rowId: string, dates: string[], checked: boolean): Promise<void> {
  const rowCells = await db.gridCells.where('rowId').equals(rowId).toArray()
  const cellByDate = new Map(rowCells.map((c) => [c.date, c]))
  await db.transaction('rw', db.gridCells, async () => {
    for (const date of dates) {
      const existing = cellByDate.get(date)
      if (checked && !existing) {
        await db.gridCells.add({ id: uuid(), rowId, date, createdAt: Date.now() })
      } else if (!checked && existing) {
        await db.gridCells.delete(existing.id)
      }
    }
  })
}

/** SM-3: deleting a section permanently removes it, every row inside it, and those rows' entire
 *  checkbox history — there's no "keep history" option per the PRD. */
export async function deleteGridSection(sectionId: string): Promise<void> {
  const rows = await db.gridRows.where('sectionId').equals(sectionId).toArray()
  await db.transaction('rw', db.tables, async () => {
    await db.gridSections.delete(sectionId)
    await db.gridRows.bulkDelete(rows.map((r) => r.id))
    for (const row of rows) {
      const cells = await db.gridCells.where('rowId').equals(row.id).toArray()
      await db.gridCells.bulkDelete(cells.map((c) => c.id))
    }
  })
}

/** RM-3: deleting a row permanently removes it and its entire checkbox history. */
export async function deleteGridRow(rowId: string): Promise<void> {
  const cells = await db.gridCells.where('rowId').equals(rowId).toArray()
  await db.transaction('rw', db.tables, async () => {
    await db.gridRows.delete(rowId)
    await db.gridCells.bulkDelete(cells.map((c) => c.id))
  })
}
