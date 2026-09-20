import { beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeRow {
  user_id: string
  table_name: string
  id: string
  data: Record<string, unknown>
}

/**
 * A minimal fake of the Supabase JS client's PostgREST query builder, faithful enough to exercise
 * CloudTable's translation logic end to end without any network access — which this sandbox doesn't
 * have to a real Supabase project anyway. Every `.from('records')` call chain here mirrors exactly
 * what cloudTable.ts issues in the real client.
 */
function createFakeSupabaseClient() {
  let rows: FakeRow[] = []

  function matches(row: FakeRow, filters: [string, 'eq' | 'in', unknown][]): boolean {
    return filters.every(([col, op, val]) => {
      const rowValue = (row as unknown as Record<string, unknown>)[col]
      return op === 'eq' ? rowValue === val : (val as unknown[]).includes(rowValue)
    })
  }

  function from(_table: string) {
    const filters: [string, 'eq' | 'in', unknown][] = []
    let mode: 'select' | 'insert' | 'upsert' | 'delete' = 'select'
    let selectOpts: { count?: string; head?: boolean } | undefined
    let insertPayload: FakeRow[] = []
    let upsertPayload: FakeRow | undefined
    let single = false

    const builder = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        mode = 'select'
        selectOpts = opts
        return builder
      },
      insert(payload: FakeRow | FakeRow[]) {
        mode = 'insert'
        insertPayload = Array.isArray(payload) ? payload : [payload]
        return builder
      },
      upsert(payload: FakeRow) {
        mode = 'upsert'
        upsertPayload = payload
        return builder
      },
      delete() {
        mode = 'delete'
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push([col, 'eq', val])
        return builder
      },
      in(col: string, vals: unknown[]) {
        filters.push([col, 'in', vals])
        return builder
      },
      maybeSingle() {
        single = true
        return builder
      },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        try {
          if (mode === 'select') {
            const matched = rows.filter((r) => matches(r, filters))
            if (selectOpts?.count === 'exact' && selectOpts?.head) {
              resolve({ data: null, error: null, count: matched.length })
              return
            }
            if (single) {
              resolve({ data: matched[0] ? { data: matched[0].data } : null, error: null })
              return
            }
            resolve({ data: matched.map((r) => ({ id: r.id, data: r.data })), error: null })
            return
          }
          if (mode === 'insert') {
            for (const p of insertPayload) {
              if (rows.some((r) => r.user_id === p.user_id && r.table_name === p.table_name && r.id === p.id)) {
                resolve({ error: { message: 'duplicate key value violates unique constraint' } })
                return
              }
            }
            rows.push(...insertPayload)
            resolve({ error: null })
            return
          }
          if (mode === 'upsert') {
            const idx = rows.findIndex(
              (r) => r.user_id === upsertPayload!.user_id && r.table_name === upsertPayload!.table_name && r.id === upsertPayload!.id,
            )
            if (idx >= 0) rows[idx] = upsertPayload!
            else rows.push(upsertPayload!)
            resolve({ error: null })
            return
          }
          if (mode === 'delete') {
            rows = rows.filter((r) => !matches(r, filters))
            resolve({ error: null })
          }
        } catch (e) {
          reject(e)
        }
      },
    }
    return builder
  }

  function channel() {
    return {
      on() {
        return this
      },
      subscribe() {
        return { unsubscribe() {} }
      },
    }
  }

  return { from, channel, reset: () => (rows = []) }
}

const fakeClient = createFakeSupabaseClient()

vi.mock('../lib/supabaseClient', () => ({
  requireSupabase: async () => fakeClient,
}))

const { getCloudTable, setCloudUserId } = await import('./cloudTable')

interface FakeTask extends Record<string, unknown> {
  id: string
  dayId: string
  title: string
  createdAt: number
}

describe('CloudTable', () => {
  beforeEach(() => {
    fakeClient.reset()
    setCloudUserId('user-1')
  })

  it('adds and reads back a record', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.add({ id: 't1', dayId: 'd1', title: 'Read', createdAt: 1 })
    expect(await tasks.get('t1')).toEqual({ id: 't1', dayId: 'd1', title: 'Read', createdAt: 1 })
  })

  it('rejects adding a duplicate id', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.add({ id: 't1', dayId: 'd1', title: 'Read', createdAt: 1 })
    await expect(tasks.add({ id: 't1', dayId: 'd1', title: 'Read again', createdAt: 2 })).rejects.toBeTruthy()
  })

  it('put() upserts', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.put({ id: 't1', dayId: 'd1', title: 'Read', createdAt: 1 })
    await tasks.put({ id: 't1', dayId: 'd1', title: 'Read more', createdAt: 1 })
    expect((await tasks.get('t1'))?.title).toBe('Read more')
  })

  it('update() merges a patch and reports whether a row existed', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.add({ id: 't1', dayId: 'd1', title: 'Read', createdAt: 1 })
    expect(await tasks.update('t1', { title: 'Read updated' })).toBe(1)
    expect((await tasks.get('t1'))?.title).toBe('Read updated')
    expect(await tasks.update('missing', { title: 'x' })).toBe(0)
  })

  it('delete() removes a row', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.add({ id: 't1', dayId: 'd1', title: 'Read', createdAt: 1 })
    await tasks.delete('t1')
    expect(await tasks.get('t1')).toBeUndefined()
  })

  it('where().equals() filters by field', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.bulkAdd([
      { id: 't1', dayId: 'd1', title: 'A', createdAt: 1 },
      { id: 't2', dayId: 'd2', title: 'B', createdAt: 2 },
      { id: 't3', dayId: 'd1', title: 'C', createdAt: 3 },
    ])
    const inDay1 = await tasks.where('dayId').equals('d1').toArray()
    expect(inDay1.map((t) => t.id).sort()).toEqual(['t1', 't3'])
  })

  it('where().anyOf() filters by a set of values', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.bulkAdd([
      { id: 't1', dayId: 'd1', title: 'A', createdAt: 1 },
      { id: 't2', dayId: 'd2', title: 'B', createdAt: 2 },
      { id: 't3', dayId: 'd3', title: 'C', createdAt: 3 },
    ])
    const matched = await tasks.where('dayId').anyOf(['d1', 'd3']).toArray()
    expect(matched.map((t) => t.id).sort()).toEqual(['t1', 't3'])
  })

  it('where().between() is inclusive on both ends', async () => {
    const days = getCloudTable<{ id: string; date: string }>('days')
    await days.bulkAdd([
      { id: 'd1', date: '2026-09-18' },
      { id: 'd2', date: '2026-09-19' },
      { id: 'd3', date: '2026-09-20' },
      { id: 'd4', date: '2026-09-21' },
    ])
    const inRange = await days.where('date').between('2026-09-19', '2026-09-20', true, true).toArray()
    expect(inRange.map((d) => d.id).sort()).toEqual(['d2', 'd3'])
  })

  it('orderBy() sorts ascending, and reverse() descending', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.bulkAdd([
      { id: 't1', dayId: 'd1', title: 'A', createdAt: 3 },
      { id: 't2', dayId: 'd1', title: 'B', createdAt: 1 },
      { id: 't3', dayId: 'd1', title: 'C', createdAt: 2 },
    ])
    expect((await tasks.orderBy('createdAt').toArray()).map((t) => t.id)).toEqual(['t2', 't3', 't1'])
    expect((await tasks.orderBy('createdAt').reverse().toArray()).map((t) => t.id)).toEqual(['t1', 't3', 't2'])
  })

  it('count() reflects only rows in this table, for this user', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    const goals = getCloudTable<Record<string, unknown>>('goals')
    await tasks.bulkAdd([
      { id: 't1', dayId: 'd1', title: 'A', createdAt: 1 },
      { id: 't2', dayId: 'd1', title: 'B', createdAt: 2 },
    ])
    await goals.add({ id: 'g1', title: 'Goal' })
    expect(await tasks.count()).toBe(2)
    expect(await goals.count()).toBe(1)
  })

  it('bulkDelete() removes exactly the given ids', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.bulkAdd([
      { id: 't1', dayId: 'd1', title: 'A', createdAt: 1 },
      { id: 't2', dayId: 'd1', title: 'B', createdAt: 2 },
      { id: 't3', dayId: 'd1', title: 'C', createdAt: 3 },
    ])
    await tasks.bulkDelete(['t1', 't3'])
    expect((await tasks.toCollection().toArray()).map((t) => t.id)).toEqual(['t2'])
  })

  it('clear() empties only that table', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    const goals = getCloudTable<Record<string, unknown>>('goals')
    await tasks.add({ id: 't1', dayId: 'd1', title: 'A', createdAt: 1 })
    await goals.add({ id: 'g1', title: 'Goal' })
    await tasks.clear()
    expect(await tasks.count()).toBe(0)
    expect(await goals.count()).toBe(1)
  })

  it('round-trips a Blob field through data-URL serialization for blob-bearing tables', async () => {
    const voiceNotes = getCloudTable<{ id: string; taskId: string; blob: Blob; createdAt: number }>('voiceNotes')
    const original = new Blob(['hello world'], { type: 'audio/webm' })
    await voiceNotes.add({ id: 'v1', taskId: 't1', blob: original, createdAt: 1 })
    const back = await voiceNotes.get('v1')
    // Node's fetch() (used by dataUrlToBlob) and jsdom's global Blob are different realms, so
    // `instanceof` isn't reliable here even though this is a real Blob in an actual browser —
    // assert on behavior instead.
    expect(back?.blob.size).toBe(11)
    expect(back?.blob.type).toBe('audio/webm')
    expect(await back?.blob.text()).toBe('hello world')
  })

  it('scopes rows to the current user id', async () => {
    const tasks = getCloudTable<FakeTask>('tasks')
    await tasks.add({ id: 't1', dayId: 'd1', title: 'User 1 task', createdAt: 1 })
    setCloudUserId('user-2')
    expect(await tasks.get('t1')).toBeUndefined()
    expect(await tasks.count()).toBe(0)
  })
})
