import type { RealtimeChannel } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabaseClient'
import { blobToDataUrl, dataUrlToBlob } from '../lib/blobUtils'
import { emitDbChange } from './dbEvents'

let currentUserId: string | null = null
let realtimeChannel: RealtimeChannel | null = null
let realtimeGeneration = 0

/**
 * Called by db.ts whenever auth state changes, so every CloudTable knows whose rows to read/write.
 * Also (re)subscribes to Supabase Realtime for this account's rows, so a change made on another
 * device or browser tab shows up here live via the same dbEvents signal local writes use.
 */
export function setCloudUserId(userId: string | null): void {
  currentUserId = userId
  realtimeGeneration += 1
  const generation = realtimeGeneration
  teardownRealtime()
  if (userId) void setupRealtime(userId, generation)
}

async function setupRealtime(userId: string, generation: number): Promise<void> {
  const client = await requireSupabase()
  if (generation !== realtimeGeneration) return // superseded by a more recent login/logout
  realtimeChannel = client
    .channel(`records-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${userId}` }, () => {
      emitDbChange()
    })
    .subscribe()
}

function teardownRealtime(): void {
  const channel = realtimeChannel
  realtimeChannel = null
  if (channel) void channel.unsubscribe()
}

function requireUserId(): string {
  if (!currentUserId) throw new Error('Not logged in.')
  return currentUserId
}

/**
 * Tables whose records carry a raw Blob field that can't go into JSON/JSONB directly. Serialized to
 * a data: URL string for storage (same technique already used by Settings → Export All Data) and
 * converted back to a real Blob on read.
 */
const BLOB_FIELDS: Record<string, string> = {
  voiceNotes: 'blob',
  completionPhotos: 'blob',
}

async function serializeForStorage(tableName: string, record: Record<string, unknown>): Promise<Record<string, unknown>> {
  const blobField = BLOB_FIELDS[tableName]
  if (!blobField || !(record[blobField] instanceof Blob)) return record
  const { [blobField]: blob, ...rest } = record
  return { ...rest, __blobDataUrl: await blobToDataUrl(blob as Blob) }
}

async function deserializeFromStorage(tableName: string, stored: Record<string, unknown>): Promise<Record<string, unknown>> {
  const blobField = BLOB_FIELDS[tableName]
  const dataUrl = stored.__blobDataUrl
  if (!blobField || typeof dataUrl !== 'string') return stored
  const { __blobDataUrl, ...rest } = stored
  return { ...rest, [blobField]: await dataUrlToBlob(dataUrl) }
}

interface StoredRow {
  id: string
  data: Record<string, unknown>
}

async function fetchAllRows(tableName: string): Promise<Record<string, unknown>[]> {
  const client = await requireSupabase()
  const userId = requireUserId()
  const { data, error } = await client.from('records').select('id, data').eq('user_id', userId).eq('table_name', tableName)
  if (error) throw error
  const rows = (data ?? []) as StoredRow[]
  return Promise.all(rows.map((row) => deserializeFromStorage(tableName, row.data)))
}

async function fetchOneRow(tableName: string, id: string): Promise<Record<string, unknown> | undefined> {
  const client = await requireSupabase()
  const userId = requireUserId()
  const { data: row, error } = await client
    .from('records')
    .select('data')
    .eq('user_id', userId)
    .eq('table_name', tableName)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!row) return undefined
  return deserializeFromStorage(tableName, (row as { data: Record<string, unknown> }).data)
}

async function writeRow(tableName: string, id: string, record: Record<string, unknown>): Promise<void> {
  const client = await requireSupabase()
  const userId = requireUserId()
  const serialized = await serializeForStorage(tableName, record)
  const { error } = await client
    .from('records')
    .upsert({ user_id: userId, table_name: tableName, id, data: serialized, updated_at: new Date().toISOString() }, { onConflict: 'user_id,table_name,id' })
  if (error) throw error
}

async function insertRow(tableName: string, id: string, record: Record<string, unknown>): Promise<void> {
  const client = await requireSupabase()
  const userId = requireUserId()
  const serialized = await serializeForStorage(tableName, record)
  const { error } = await client.from('records').insert({ user_id: userId, table_name: tableName, id, data: serialized })
  if (error) throw error
}

function compareAscending(a: unknown, b: unknown): number {
  if (a === b) return 0
  return (a as string | number) < (b as string | number) ? -1 : 1
}

function inRange(value: unknown, lower: unknown, upper: unknown, incLower: boolean, incUpper: boolean): boolean {
  const aboveLower = incLower ? (value as string | number) >= (lower as string | number) : (value as string | number) > (lower as string | number)
  const belowUpper = incUpper ? (value as string | number) <= (upper as string | number) : (value as string | number) < (upper as string | number)
  return aboveLower && belowUpper
}

/** Mirrors the small slice of Dexie's Collection API this app actually uses, over an in-memory array. */
class CloudCollection<T extends Record<string, unknown>> {
  private tableName: string
  private rowsPromise: Promise<T[]>
  private reversed: boolean

  constructor(tableName: string, rowsPromise: Promise<T[]>, reversed = false) {
    this.tableName = tableName
    this.rowsPromise = rowsPromise
    this.reversed = reversed
  }

  and(predicate: (item: T) => boolean): CloudCollection<T> {
    return new CloudCollection(this.tableName, this.rowsPromise.then((rows) => rows.filter(predicate)), this.reversed)
  }

  reverse(): CloudCollection<T> {
    return new CloudCollection(this.tableName, this.rowsPromise, !this.reversed)
  }

  async toArray(): Promise<T[]> {
    const rows = await this.rowsPromise
    return this.reversed ? [...rows].reverse() : rows
  }

  async first(): Promise<T | undefined> {
    const rows = await this.toArray()
    return rows[0]
  }

  /** Dexie's sortBy always sorts ascending by the given key, regardless of a preceding .reverse(). */
  async sortBy(key: string): Promise<T[]> {
    const rows = await this.rowsPromise
    return [...rows].sort((a, b) => compareAscending(a[key], b[key]))
  }

  async count(): Promise<number> {
    const rows = await this.rowsPromise
    return rows.length
  }

  async delete(): Promise<number> {
    const rows = await this.rowsPromise
    const table = getCloudTable<T>(this.tableName)
    await Promise.all(rows.map((row) => table.delete(row.id as string)))
    return rows.length
  }

  async modify(changes: Partial<T> | ((item: T) => void)): Promise<number> {
    const rows = await this.rowsPromise
    const table = getCloudTable<T>(this.tableName)
    await Promise.all(
      rows.map(async (row) => {
        if (typeof changes === 'function') {
          const draft = { ...row }
          changes(draft)
          await table.put(draft)
        } else {
          await table.update(row.id as string, changes)
        }
      }),
    )
    return rows.length
  }
}

class CloudWhereClause<T extends Record<string, unknown>> {
  private tableName: string
  private field: string
  private rowsPromise: Promise<T[]>

  constructor(tableName: string, field: string, rowsPromise: Promise<T[]>) {
    this.tableName = tableName
    this.field = field
    this.rowsPromise = rowsPromise
  }

  equals(value: unknown): CloudCollection<T> {
    return new CloudCollection(this.tableName, this.rowsPromise.then((rows) => rows.filter((r) => r[this.field] === value)))
  }

  anyOf(values: unknown[]): CloudCollection<T> {
    const set = new Set(values)
    return new CloudCollection(this.tableName, this.rowsPromise.then((rows) => rows.filter((r) => set.has(r[this.field]))))
  }

  between(lower: unknown, upper: unknown, incLower = true, incUpper = true): CloudCollection<T> {
    return new CloudCollection(
      this.tableName,
      this.rowsPromise.then((rows) => rows.filter((r) => inRange(r[this.field], lower, upper, incLower, incUpper))),
    )
  }
}

class CloudOrderByClause<T extends Record<string, unknown>> {
  private rowsPromise: Promise<T[]>
  private field: string

  constructor(rowsPromise: Promise<T[]>, field: string) {
    this.rowsPromise = rowsPromise
    this.field = field
  }

  async toArray(): Promise<T[]> {
    const rows = await this.rowsPromise
    return [...rows].sort((a, b) => compareAscending(a[this.field], b[this.field]))
  }

  reverse(): { toArray(): Promise<T[]> } {
    return {
      toArray: async () => {
        const rows = await this.toArray()
        return rows.reverse()
      },
    }
  }
}

/** Dexie-compatible facade for one logical table, backed by Supabase's `records` table. */
export class CloudTable<T extends Record<string, unknown>> {
  private tableName: string

  constructor(tableName: string) {
    this.tableName = tableName
  }

  private all(): Promise<T[]> {
    return fetchAllRows(this.tableName) as Promise<T[]>
  }

  async get(id: string): Promise<T | undefined> {
    return (await fetchOneRow(this.tableName, id)) as T | undefined
  }

  async add(record: T): Promise<string> {
    const id = record.id as string
    await insertRow(this.tableName, id, record)
    emitDbChange()
    return id
  }

  async put(record: T): Promise<string> {
    const id = record.id as string
    await writeRow(this.tableName, id, record)
    emitDbChange()
    return id
  }

  async update(id: string, patch: Partial<T>): Promise<number> {
    const existing = await fetchOneRow(this.tableName, id)
    if (!existing) return 0
    await writeRow(this.tableName, id, { ...existing, ...patch })
    emitDbChange()
    return 1
  }

  async delete(id: string): Promise<void> {
    const client = await requireSupabase()
    const userId = requireUserId()
    const { error } = await client.from('records').delete().eq('user_id', userId).eq('table_name', this.tableName).eq('id', id)
    if (error) throw error
    emitDbChange()
  }

  async bulkAdd(records: T[]): Promise<string> {
    if (records.length === 0) return ''
    const client = await requireSupabase()
    const userId = requireUserId()
    const rows = await Promise.all(
      records.map(async (record) => ({
        user_id: userId,
        table_name: this.tableName,
        id: record.id as string,
        data: await serializeForStorage(this.tableName, record),
      })),
    )
    const { error } = await client.from('records').insert(rows)
    if (error) throw error
    emitDbChange()
    return records[records.length - 1].id as string
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const client = await requireSupabase()
    const userId = requireUserId()
    const { error } = await client.from('records').delete().eq('user_id', userId).eq('table_name', this.tableName).in('id', ids)
    if (error) throw error
    emitDbChange()
  }

  async clear(): Promise<void> {
    const client = await requireSupabase()
    const userId = requireUserId()
    const { error } = await client.from('records').delete().eq('user_id', userId).eq('table_name', this.tableName)
    if (error) throw error
    emitDbChange()
  }

  async count(): Promise<number> {
    const client = await requireSupabase()
    const userId = requireUserId()
    const { count, error } = await client
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('table_name', this.tableName)
    if (error) throw error
    return count ?? 0
  }

  where(field: string): CloudWhereClause<T> {
    return new CloudWhereClause(this.tableName, field, this.all())
  }

  orderBy(field: string): CloudOrderByClause<T> {
    return new CloudOrderByClause(this.all(), field)
  }

  filter(predicate: (item: T) => boolean): { toArray(): Promise<T[]> } {
    return { toArray: async () => (await this.all()).filter(predicate) }
  }

  toCollection(): CloudCollection<T> {
    return new CloudCollection(this.tableName, this.all())
  }
}

const cloudTableCache = new Map<string, CloudTable<Record<string, unknown>>>()

export function getCloudTable<T extends Record<string, unknown>>(tableName: string): CloudTable<T> {
  let table = cloudTableCache.get(tableName)
  if (!table) {
    table = new CloudTable(tableName)
    cloudTableCache.set(tableName, table)
  }
  return table as unknown as CloudTable<T>
}
