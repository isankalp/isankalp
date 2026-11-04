import { v4 as uuid } from 'uuid'
import { db, getOrCreateDay } from '../db/db'

export interface ColumnMapping {
  title: number | null
  minutesPerSubtask: number | null
  totalSubtasks: number | null
}

export function isMappingValid(mapping: ColumnMapping): boolean {
  return mapping.title !== null && mapping.minutesPerSubtask !== null && mapping.totalSubtasks !== null
}

export interface ImportRow {
  /** 1-based row number within the data rows (excluding header), for display. */
  rowIndex: number
  title: string
  minutesPerSubtaskRaw: string
  totalSubtasksRaw: string
  valid: boolean
  reason?: string
  minutesPerSubtask?: number
  totalSubtasks?: number
}

/** EC-4: builds a preview where each row is validated independently — one bad row never blocks the rest. */
export function buildImportRows(dataRows: string[][], mapping: ColumnMapping): ImportRow[] {
  if (!isMappingValid(mapping)) return []
  return dataRows.map((row, i) => {
    const title = (row[mapping.title!] ?? '').trim()
    const minutesRaw = (row[mapping.minutesPerSubtask!] ?? '').trim()
    const totalRaw = (row[mapping.totalSubtasks!] ?? '').trim()
    const base = { rowIndex: i + 1, title, minutesPerSubtaskRaw: minutesRaw, totalSubtasksRaw: totalRaw }

    if (!title) return { ...base, valid: false, reason: 'Missing title' }

    const minutes = Number(minutesRaw)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return { ...base, valid: false, reason: 'minutesPerSubtask must be a positive number' }
    }

    const total = Number(totalRaw)
    if (!Number.isFinite(total) || total <= 0) {
      return { ...base, valid: false, reason: 'totalSubtasks must be a positive number' }
    }

    return { ...base, valid: true, minutesPerSubtask: minutes, totalSubtasks: Math.floor(total) }
  })
}

/** EC-3/EC-5: writes only the valid, previewed rows — never called until the user explicitly confirms Import. */
export async function commitImport(rows: ImportRow[], targetDate: string): Promise<number> {
  const validRows = rows.filter((r) => r.valid && r.minutesPerSubtask !== undefined && r.totalSubtasks !== undefined)
  if (validRows.length === 0) return 0
  const day = await getOrCreateDay(targetDate)
  const now = Date.now()
  await db.tasks.bulkAdd(
    validRows.map((r) => ({
      id: uuid(),
      title: r.title,
      dayId: day.id,
      minutesPerSubtask: r.minutesPerSubtask as number,
      totalSubtasks: r.totalSubtasks as number,
      completedSubtasks: 0,
      priority: 'Medium' as const,
      createdAt: now,
      updatedAt: now,
    })),
  )
  return validRows.length
}
