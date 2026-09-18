import { db } from '../db/db'
import type { Day, Goal, Settings, Task } from '../db/models'

interface Backup {
  version: 1
  exportedAt: string
  tasks: Task[]
  days: Day[]
  goals: Goal[]
  settings: Settings | undefined
}

export async function exportData(): Promise<string> {
  const [tasks, days, goals, settings] = await Promise.all([
    db.tasks.toArray(),
    db.days.toArray(),
    db.goals.toArray(),
    db.settings.get('settings'),
  ])
  const backup: Backup = { version: 1, exportedAt: new Date().toISOString(), tasks, days, goals, settings }
  return JSON.stringify(backup, null, 2)
}

export function downloadExport(json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `goals-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(json: string): Promise<void> {
  const backup = JSON.parse(json) as Backup
  if (!backup || backup.version !== 1) {
    throw new Error('Unrecognized backup file format')
  }
  await db.transaction('rw', db.tasks, db.days, db.goals, db.settings, async () => {
    await Promise.all([db.tasks.clear(), db.days.clear(), db.goals.clear(), db.settings.clear()])
    await db.days.bulkAdd(backup.days ?? [])
    await db.tasks.bulkAdd(backup.tasks ?? [])
    await db.goals.bulkAdd(backup.goals ?? [])
    if (backup.settings) await db.settings.put(backup.settings)
  })
}
