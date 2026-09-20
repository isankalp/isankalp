import { minutesDone, totalMinutes, type Task } from '../db/models'

export const GRID_START_HOUR = 6
export const GRID_END_HOUR = 23
export const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60

/** Parses "HH:MM" into minutes since the grid's start (6am), clamped to the visible grid range. */
export function timeToGridMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const minutes = (h - GRID_START_HOUR) * 60 + (m || 0)
  return Math.min(Math.max(minutes, 0), GRID_TOTAL_MINUTES)
}

/** Inverse of timeToGridMinutes — formats minutes-since-grid-start back into "HH:MM" 24h local time. */
export function gridMinutesToTime(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), GRID_TOTAL_MINUTES)
  const totalMinutes = GRID_START_HOUR * 60 + clamped
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** TB-2/TB-3: drag-drop and resize both snap to the nearest 15-minute increment. */
export function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

export interface TimeBlock {
  id: string
  start: number // minutes since grid start
  duration: number // minutes
}

function overlaps(a: TimeBlock, b: TimeBlock): boolean {
  return a.start < b.start + b.duration && b.start < a.start + a.duration
}

/** TB-4: every block that overlaps at least one other, flagged — never silently allowed to overlap unmarked. */
export function overlappingBlockIds(blocks: TimeBlock[]): Set<string> {
  const overlapping = new Set<string>()
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (overlaps(blocks[i], blocks[j])) {
        overlapping.add(blocks[i].id)
        overlapping.add(blocks[j].id)
      }
    }
  }
  return overlapping
}

/** TB-2: a freshly-dropped block defaults to the task's remaining minutes, with a sensible visible minimum. */
export function defaultBlockDuration(task: Pick<Task, 'minutesPerSubtask' | 'totalSubtasks' | 'completedSubtasks'>): number {
  const remaining = totalMinutes(task) - minutesDone(task)
  return Math.max(15, remaining)
}

export interface BlockLayout {
  id: string
  column: number
  columnCount: number
}

/**
 * Splits each cluster of mutually-overlapping blocks into side-by-side columns, so an overlap is not just
 * flagged (TB-4) but every block — including one fully covered by another — stays independently clickable.
 * Non-overlapping blocks get columnCount 1 (full width), unchanged from before this existed.
 */
export function layoutBlocks(blocks: TimeBlock[]): BlockLayout[] {
  const neighbors = new Map<string, string[]>(blocks.map((b) => [b.id, []]))
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (overlaps(blocks[i], blocks[j])) {
        neighbors.get(blocks[i].id)!.push(blocks[j].id)
        neighbors.get(blocks[j].id)!.push(blocks[i].id)
      }
    }
  }

  const visited = new Set<string>()
  const result: BlockLayout[] = []
  for (const block of blocks) {
    if (visited.has(block.id)) continue
    const cluster: string[] = []
    const queue = [block.id]
    visited.add(block.id)
    while (queue.length > 0) {
      const id = queue.shift()!
      cluster.push(id)
      for (const neighborId of neighbors.get(id) ?? []) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          queue.push(neighborId)
        }
      }
    }
    cluster.sort()
    cluster.forEach((id, index) => result.push({ id, column: index, columnCount: cluster.length }))
  }
  return result
}
