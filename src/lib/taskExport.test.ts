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

function csvOf(tasks: Task[], days: Day[], customFields: CustomFieldDef[] = []) {
  return buildTaskExportCsv(tasks, days, customFields).csv
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
  it('writes a header row followed by one row per task with no named subtasks', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask()]
    const rows = parseCsv(csvOf(tasks, days))
    expect(rows[0][0]).toBe('Date')
    expect(rows.length).toBe(2)
  })

  it('computes derived values the same way the app does (EF-5)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask({ minutesPerSubtask: 10, totalSubtasks: 4, completedSubtasks: 3 })]
    const rows = parseCsv(csvOf(tasks, days))
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
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    const row = rows[1]
    expect(row[header.indexOf('Date')]).toBe('2026-11-01')
    expect(row[header.indexOf('Created At')]).toBe(new Date(Date.UTC(2026, 10, 1, 12, 30, 0)).toISOString())
  })

  it('preserves commas, quotes, line breaks and non-English characters round-trip (EF-8/SX-11)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask({ title: 'Read, "write" and\nreview — déjà vu 日本語', notes: 'a, "b"\nc' })]
    const rows = parseCsv(csvOf(tasks, days))
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
    const rows = parseCsv(csvOf(tasks, days))
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
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    expect(rows[1][header.indexOf('Tags')]).toBe('Deep Work')
  })

  it('leaves the Tags cell empty for a task with no category', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const tasks = [makeTask()]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    expect(rows[1][header.indexOf('Tags')]).toBe('')
  })

  it('appends one column per custom field, before the trailing Task ID column (EF-3)', () => {
    const days = [makeDay('d1', '2026-11-01')]
    const fields: CustomFieldDef[] = [
      { id: 'f1', name: 'Energy', type: 'number', createdAt: 0 },
      { id: 'f2', name: 'Mood', type: 'text', createdAt: 0 },
    ]
    const tasks = [makeTask({ id: 'a', customFieldValues: { f1: 8 } }), makeTask({ id: 'b' })]
    const rows = parseCsv(csvOf(tasks, days, fields))
    const header = rows[0]
    expect(header.slice(-3)).toEqual(['Energy', 'Mood', 'Task ID'])
    expect(rows[1][header.indexOf('Energy')]).toBe('8')
    expect(rows[1][header.indexOf('Mood')]).toBe('')
    expect(rows[2][header.indexOf('Energy')]).toBe('')
  })
})

describe('Epic 90 — subtask row expansion', () => {
  const days = [makeDay('d1', '2026-11-03')]

  it('exports a task with no named subtasks as exactly one self-linked row (SX-2/SX-3/SX-4)', () => {
    const tasks = [makeTask({ title: 'Sample 1', totalSubtasks: 3, completedSubtasks: 1 })]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    expect(rows.length).toBe(2)
    expect(rows[1][header.indexOf('Main Task')]).toBe('Sample 1')
    expect(rows[1][header.indexOf('Subtask')]).toBe('Sample 1')
    expect(rows[1][header.indexOf('Subtask #')]).toBe('1')
  })

  it('a self-linked row is Done only when the task itself is at 100% (SX-8)', () => {
    const header0 = parseCsv(csvOf([makeTask({ totalSubtasks: 4, completedSubtasks: 4 })], days))[0]
    const doneRow = parseCsv(csvOf([makeTask({ totalSubtasks: 4, completedSubtasks: 4 })], days))[1]
    expect(doneRow[header0.indexOf('Subtask Status')]).toBe('Done')

    const notDoneRow = parseCsv(csvOf([makeTask({ totalSubtasks: 4, completedSubtasks: 3 })], days))[1]
    expect(notDoneRow[header0.indexOf('Subtask Status')]).toBe('Not Done')
  })

  it('exports N rows sharing one Main Task for a task with N named subtasks (SX-1/SX-5)', () => {
    const tasks = [
      makeTask({
        title: 'Sample 2',
        subtaskItems: [
          { id: 's1', title: 'Test 1', completed: true },
          { id: 's2', title: 'Test 2', completed: false },
        ],
      }),
    ]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    expect(rows.length).toBe(3)
    expect(rows[1][header.indexOf('Main Task')]).toBe('Sample 2')
    expect(rows[2][header.indexOf('Main Task')]).toBe('Sample 2')
    expect(rows[1][header.indexOf('Subtask')]).toBe('Test 1')
    expect(rows[2][header.indexOf('Subtask')]).toBe('Test 2')
    expect(rows[1][header.indexOf('Subtask #')]).toBe('1')
    expect(rows[2][header.indexOf('Subtask #')]).toBe('2')
    expect(rows[1][header.indexOf('Subtask Status')]).toBe('Done')
    expect(rows[2][header.indexOf('Subtask Status')]).toBe('Not Done')
  })

  it('keeps a task with zero named subtasks (SC-3) as exactly one self-linked row', () => {
    const tasks = [makeTask({ title: 'Edge case', subtaskItems: [] })]
    const rows = parseCsv(csvOf(tasks, days))
    expect(rows.length).toBe(2)
    const header = rows[0]
    expect(rows[1][header.indexOf('Subtask')]).toBe('Edge case')
  })

  it('never exports a row for a deleted subtask (SC-4)', () => {
    const tasks = [
      makeTask({
        title: 'Sample 2',
        subtaskItems: [{ id: 's1', title: 'Test 1', completed: true }],
      }),
    ]
    const rows = parseCsv(csvOf(tasks, days))
    expect(rows.length).toBe(2)
    expect(rows.some((r) => r.includes('Test 2'))).toBe(false)
  })

  it('repeats task-level columns identically across a task\'s subtask rows (SX-9)', () => {
    const tasks = [
      makeTask({
        title: 'Sample 2',
        priority: 'High',
        notes: 'shared note',
        subtaskItems: [
          { id: 's1', title: 'Test 1', completed: true },
          { id: 's2', title: 'Test 2', completed: false },
        ],
      }),
    ]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    const col = (name: string) => header.indexOf(name)
    for (const name of ['Status', 'Unit', 'Priority', 'Notes', 'Created At', 'Percent Complete']) {
      expect(rows[1][col(name)]).toBe(rows[2][col(name)])
    }
    expect(rows[1][col('Priority')]).toBe('High')
    expect(rows[1][col('Notes')]).toBe('shared note')
  })

  it('keeps Status as Blocked/Rejected on every subtask row, never Completed (SX-10)', () => {
    const blocked = [
      makeTask({
        blockedAt: 100,
        subtaskItems: [
          { id: 's1', title: 'Test 1', completed: true },
          { id: 's2', title: 'Test 2', completed: true },
        ],
      }),
    ]
    const rows = parseCsv(csvOf(blocked, days))
    const header = rows[0]
    expect(rows[1][header.indexOf('Status')]).toBe('Blocked')
    expect(rows[2][header.indexOf('Status')]).toBe('Blocked')
  })

  it('keeps a task\'s subtask rows adjacent and in app order within the date/creation sort (SX-6)', () => {
    const tasks = [
      makeTask({
        id: 'a',
        title: 'First task',
        createdAt: 1,
        subtaskItems: [
          { id: 's1', title: 'A-1', completed: false },
          { id: 's2', title: 'A-2', completed: false },
        ],
      }),
      makeTask({ id: 'b', title: 'Second task', createdAt: 2 }),
    ]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    const mains = rows.slice(1).map((r) => r[header.indexOf('Main Task')])
    expect(mains).toEqual(['First task', 'First task', 'Second task'])
  })

  it('exports a Subtask # index of 1 for every self-linked row (SX-12)', () => {
    const tasks = [makeTask()]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    expect(rows[1][header.indexOf('Subtask #')]).toBe('1')
  })
})

describe('Epic 91 — export count & integrity', () => {
  const days = [makeDay('d1', '2026-11-03')]

  it('reports distinct task count and total row count separately (SC-1)', () => {
    const tasks = [
      makeTask({ id: 'a', subtaskItems: [{ id: 's1', title: 'X', completed: false }, { id: 's2', title: 'Y', completed: false }] }),
      makeTask({ id: 'b' }),
    ]
    const { rowCount } = buildTaskExportCsv(tasks, days, [])
    expect(tasks.length).toBe(2) // N
    expect(rowCount).toBe(3) // R: 2 subtask rows + 1 self-linked row
  })

  it('never drops or duplicates a task across expansion (SC-2)', () => {
    const tasks = [
      makeTask({ id: 'a', subtaskItems: [{ id: 's1', title: 'X', completed: false }] }),
      makeTask({ id: 'b' }),
      makeTask({ id: 'c', subtaskItems: [{ id: 's2', title: 'Y', completed: false }, { id: 's3', title: 'Z', completed: true }] }),
    ]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    const taskIds = rows.slice(1).map((r) => r[header.indexOf('Task ID')])
    expect(new Set(taskIds)).toEqual(new Set(['a', 'b', 'c']))
    expect(taskIds.filter((id) => id === 'a').length).toBe(1)
    expect(taskIds.filter((id) => id === 'c').length).toBe(2)
  })

  it('distinguishes two same-titled tasks on the same date by Task ID (SC-5)', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Duplicate title', createdAt: 1 }),
      makeTask({ id: 'b', title: 'Duplicate title', createdAt: 2 }),
    ]
    const rows = parseCsv(csvOf(tasks, days))
    const header = rows[0]
    const idIdx = header.indexOf('Task ID')
    expect(rows[1][idIdx]).not.toBe(rows[2][idIdx])
    expect([rows[1][idIdx], rows[2][idIdx]].sort()).toEqual(['a', 'b'])
  })
})

describe('taskExportFilename (EF-12)', () => {
  it('follows the goal-tracker-tasks-YYYY-MM-DD.csv pattern', () => {
    expect(taskExportFilename('2026-11-03')).toBe('goal-tracker-tasks-2026-11-03.csv')
  })
})
