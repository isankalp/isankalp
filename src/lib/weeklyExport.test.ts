import { describe, expect, it } from 'vitest'
import type { CustomFieldDef, WeeklyPlan, WeeklyTask } from '../db/models'
import { parseCsv } from './csv'
import { buildWeeklyTaskExportCsv, weeklyTaskExportFilename } from './weeklyExport'

function makePlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: 'p1',
    name: '',
    fromDate: '2026-11-02',
    fromTime: '09:00',
    toDate: '2026-11-09',
    toTime: '18:00',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeTask(overrides: Partial<WeeklyTask> = {}): WeeklyTask {
  return {
    id: 't1',
    title: 'Task',
    planId: 'p1',
    minutesPerSubtask: 5,
    totalSubtasks: 5,
    completedSubtasks: 2,
    priority: 'Medium',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function csvOf(tasks: WeeklyTask[], plans: WeeklyPlan[], customFields: CustomFieldDef[] = []) {
  return buildWeeklyTaskExportCsv(tasks, plans, customFields).csv
}

describe('buildWeeklyTaskExportCsv (WX-4..9)', () => {
  it('includes Plan Name/From/To columns on every row (WX-6)', () => {
    const plan = makePlan({ name: 'Sprint 1', fromDate: '2026-11-02', fromTime: '09:00' })
    const rows = parseCsv(csvOf([makeTask()], [plan]))
    const header = rows[0]
    expect(rows[1][header.indexOf('Plan Name')]).toBe('Sprint 1')
    expect(rows[1][header.indexOf('Plan From')]).toContain('2026-11-02')
  })

  it('a task with no named subtasks produces exactly one self-linked row (WX-4/WX-5)', () => {
    const rows = parseCsv(csvOf([makeTask({ title: 'Sample 1' })], [makePlan()]))
    const header = rows[0]
    expect(rows.length).toBe(2)
    expect(rows[1][header.indexOf('Main Task')]).toBe('Sample 1')
    expect(rows[1][header.indexOf('Subtask')]).toBe('Sample 1')
  })

  it('a task with named subtasks produces one row per subtask, sharing Main Task (WX-4)', () => {
    const task = makeTask({
      title: 'Sample 2',
      subtaskItems: [
        { id: 's1', title: 'Test 1', completed: true },
        { id: 's2', title: 'Test 2', completed: false },
      ],
    })
    const rows = parseCsv(csvOf([task], [makePlan()]))
    const header = rows[0]
    expect(rows.length).toBe(3)
    expect(rows[1][header.indexOf('Main Task')]).toBe('Sample 2')
    expect(rows[2][header.indexOf('Main Task')]).toBe('Sample 2')
    expect(rows[1][header.indexOf('Subtask Status')]).toBe('Done')
    expect(rows[2][header.indexOf('Subtask Status')]).toBe('Not Done')
  })

  it('never includes a separate Title column (Main Task covers the name)', () => {
    const rows = parseCsv(csvOf([makeTask()], [makePlan()]))
    expect(rows[0]).not.toContain('Title')
  })

  it('labels Blocked/Rejected tasks correctly, never as Completed (WX-9)', () => {
    const blocked = makeTask({ blockedAt: 1, completedSubtasks: 3 })
    const rejected = makeTask({ id: 't2', blockedRejectedAt: 1, hasBeenBlocked: true, completedSubtasks: 3 })
    const rows = parseCsv(csvOf([blocked, rejected], [makePlan()]))
    const header = rows[0]
    const statusIdx = header.indexOf('Status')
    const statuses = rows.slice(1).map((r) => r[statusIdx])
    expect(statuses).toContain('Blocked')
    expect(statuses).toContain('Rejected')
    expect(statuses).not.toContain('Completed')
  })

  it('sorts by Plan From ascending, then task creation order, rows kept adjacent (WX-8)', () => {
    const laterPlan = makePlan({ id: 'p1', fromDate: '2026-11-09', fromTime: '09:00' })
    const earlierPlan = makePlan({ id: 'p2', fromDate: '2026-11-02', fromTime: '09:00' })
    const tasks = [
      makeTask({ id: 'a', planId: 'p1', title: 'Later plan task', createdAt: 1 }),
      makeTask({
        id: 'b',
        planId: 'p2',
        title: 'Earlier plan, two subtasks',
        createdAt: 1,
        subtaskItems: [
          { id: 's1', title: 'X', completed: false },
          { id: 's2', title: 'Y', completed: false },
        ],
      }),
      makeTask({ id: 'c', planId: 'p2', title: 'Earlier plan, later created', createdAt: 2 }),
    ]
    const rows = parseCsv(csvOf(tasks, [laterPlan, earlierPlan]))
    const header = rows[0]
    const mainTaskIdx = header.indexOf('Main Task')
    expect(rows.slice(1).map((r) => r[mainTaskIdx])).toEqual([
      'Earlier plan, two subtasks',
      'Earlier plan, two subtasks',
      'Earlier plan, later created',
      'Later plan task',
    ])
  })

  it('appends custom field columns before the trailing Task ID', () => {
    const fields: CustomFieldDef[] = [{ id: 'f1', name: 'Energy', type: 'number', createdAt: 0 }]
    const rows = parseCsv(csvOf([makeTask({ customFieldValues: { f1: 7 } })], [makePlan()], fields))
    const header = rows[0]
    expect(header.slice(-2)).toEqual(['Energy', 'Task ID'])
    expect(rows[1][header.indexOf('Energy')]).toBe('7')
  })

  it('distinguishes two same-titled tasks via Task ID', () => {
    const tasks = [makeTask({ id: 'a', title: 'Dup' }), makeTask({ id: 'b', title: 'Dup', createdAt: 1 })]
    const rows = parseCsv(csvOf(tasks, [makePlan()]))
    const header = rows[0]
    const idIdx = header.indexOf('Task ID')
    expect(rows[1][idIdx]).not.toBe(rows[2][idIdx])
  })
})

describe('weeklyTaskExportFilename (WX-16)', () => {
  it('uses a distinct filename from the daily export', () => {
    expect(weeklyTaskExportFilename('2026-11-03')).toBe('goal-tracker-weekly-tasks-2026-11-03.csv')
  })
})
