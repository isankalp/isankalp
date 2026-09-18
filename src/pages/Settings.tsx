import { useRef, useState, type ReactNode } from 'react'
import { useSettings } from '../context/SettingsContext'
import { downloadExport, exportData, importData } from '../lib/exportImport'
import type { CompletedBehavior, DefaultView, Theme } from '../db/models'

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-200 dark:border-slate-800 last:border-0">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-white dark:bg-slate-950 shadow text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Settings() {
  const { settings, updateSettings } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleExport() {
    const json = await exportData()
    downloadExport(json)
    setStatus('Backup downloaded.')
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text()
      await importData(text)
      setStatus('Data imported successfully.')
    } catch (err) {
      setStatus(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed.')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Settings</h2>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4">
        <SettingRow label="Default view" hint="Which screen opens first when you launch the app.">
          <SegmentedControl<DefaultView>
            value={settings.defaultView}
            onChange={(v) => updateSettings({ defaultView: v })}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Theme" hint="Light or dark appearance.">
          <SegmentedControl<Theme>
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Completed tasks" hint="Move finished tasks to a separate section, or leave them in place.">
          <SegmentedControl<CompletedBehavior>
            value={settings.completedBehavior}
            onChange={(v) => updateSettings({ completedBehavior: v })}
            options={[
              { value: 'move', label: 'Move to bottom' },
              { value: 'in-place', label: 'In place' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Export data" hint="Download all goals, days, and tasks as a JSON file.">
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Export JSON
          </button>
        </SettingRow>

        <SettingRow label="Import data" hint="Replaces all current data with a previously exported backup.">
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Import JSON
            </button>
          </>
        </SettingRow>
      </div>
      {status && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{status}</p>}
    </div>
  )
}
