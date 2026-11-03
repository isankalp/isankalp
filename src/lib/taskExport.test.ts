import { describe, expect, it } from 'vitest'
import type { CustomFieldDef, Day, Task } from '../db/models'
import { parseCsv } from './csv'
import { buildTaskExportCsv, taskExportFilename, taskExportStatus } from './taskExport'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Solve 5 questions',
    dayId: 'd1',
    minutesPerSubtask: 5,
    totalSubtasks: 5,
    completedSubtasks: 2,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeDay(id: string, date: string): Day {
  return { id, date }
}

describe('taskExportStatus (EF-4/EF-6)', () => {
  it('labels a plain incomplete task Active', () => {
    expect(taskExportStatus(makeTask())).toBe('Active')
  })

  it('labels a fully complete task Completed', () => {
    expect(taskExportStatus(makeTask({ totalSubtasks: 5, completedSubtasks: 5 }))).toBe('Completed')
  })

  it('labels a Blocked task Blocked, never Completed, even with partial progress', () => {
    expect(taskExportStatus(makeTask({ blockedAt: 100, completedSubtasks: 3 }))).toBe('Blocked')
  })

  it('labels a Rejected task Rejected, never Completed, even with partial progress', () => {
    expect(taskExportStatus(makeTask({ blockedRejectedAt: 100, hasBeenBlocked: true, completedSubtasks: 3 }))).toBe('Rejected')
  })
})

describe('buildTaskExportCsv (EF-1/EF-2/EF-5/EF-7/EF-8/EF-9/EF-10)', () => {
  it('writes a header row followed by one row per task', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask()]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    expect(rows[0][0]).toBe('Date')
    expect(rows.length).toBe(2)
  })

  it('computes derived values the same way the app does (EF-5)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask({ minutesPerSubtask: 10, totalSubtasks: 4, completedSubtasks: 3 })]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    const header = rows[0]
    const row = rows[1]
    const get = (col: string) => row[header.indexOf(col)]
    expect(get('Total Amount')).toBe('40')
    expect(get('Amount Done')).toBe('30')
    expect(get('Percent Complete')).toBe('75')
  })

  it('writes dates as YYYY-MM-DD and Created At as a full ISO timestamp (EF-7)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask({ createdAt: Date.UTC(2026, 10, 1, 12, 30, 0) })]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    const header = rows[0]
    const row = rows[1]
    expect(row[header.indexOf('Date')]).toBe('2026-11-01')
    expect(row[header.indexOf('Created At')]).toBe(new Date(Date.UTC(2026, 10, 1, 12, 30, 0)).toISOString())
  })

  it('preserves commas, quotes, line breaks and non-English characters round-trip (EF-8)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask({ title: 'Read, "write" and\nreview — déjà vu 日本語', notes: 'a, "b"\nc' })]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    const header = rows[0]
    const row = rows[1]
    expect(row[header.indexOf('Title')]).toBe('Read, "write" and\nreview — déjà vu 日本語')
    expect(row[header.indexOf('Notes')]).toBe('a, "b"\nc')
  })

  it('sorts rows by date ascending, then by creation order within a date (EF-9)', () => {
    const days = [makeDay('d1', '2026-11-02'), makeDay('d2', '2026-11-01')]
    const tasks = [
      makeTask({ id: 'a', dayId: 'd1', title: 'Later date', createdAt: 1 }),
      makeTask({ id: 'b', dayId: 'd2', title: 'Earlier date, later created', createdAt: 2 }),
      makeTask({ id: 'c', dayId: 'd2', title: 'Earlier date, earlier created', createdAt: 1 }),
    ]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    const header = rows[0]
    const titleIdx = header.indexOf('Title')
    expect(rows.slice(1).map((r) => r[titleIdx])).toEqual([
      'Earlier date, earlier created',
      'Earlier date, later created',
      'Later date',
    ])
  })

  it('joins tags with semicolons, from the single category label (EF-10)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask({ category: { label: 'Deep Work', color: '#000', icon: '🎯' } })]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    const header = rows[0]
    expect(rows[1][header.indexOf('Tags')]).toBe('Deep Work')
  })

  it('leaves the Tags cell empty for a task with no category', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask()]
    const csv = buildTaskExportCsv(tasks, days, [])
    const rows = parseCsv(csv)
    const header = rows[0]
    expect(rows[1][header.indexOf('Tags')]).toBe('')
  })

  it('appends one column per custom field, empty when a task has no value for it (EF-3)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const fields: CustomFieldDef[] = [
      { id: 'f1', name: 'Energy', type: 'number', createdAt: 0 },
      { id: 'f2', name: 'Mood', type: 'text', createdAt: 0 },
    ]
    const tasks = [
      makeTask({ id: 'a', customFieldValues: { f1: 8 } }),
      makeTask({ id: 'b' }),
    ]
    const csv = buildTaskExportCsv(tasks, days, fields)
    const rows = parseCsv(csv)
    const header = rows[0]
    expect(header.slice(-2)).toEqual(['Energy', 'Mood'])
    expect(rows[1][header.indexOf('Energy')]).toBe('8')
    expect(rows[1][header.indexOf('Mood')]).toBe('')
    expect(rows[2][header.indexOf('Energy')]).toBe('')
  })
})

describe('taskExportFilename (EF-12)', () => {
  it('follows the goal-tracker-tasks-YYYY-MM-DD.csv pattern', () => {
    expect(taskExportFilename('2026-11-03')).toBe('goal-tracker-tasks-2026-11-03.csv')
  })
})
