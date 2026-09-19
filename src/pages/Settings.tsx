import { useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import ImportCsvModal from '../components/ImportCsvModal'
import CustomFieldsSettings from '../components/CustomFieldsSettings'
import { useSettings } from '../context/SettingsContext'
import { downloadExport, exportData, importData } from '../lib/exportImport'
import { notificationPermission, notificationSupported, requestNotificationPermission } from '../lib/reminders'
import {
  calendarConfigured,
  completeGoogleCalendarAuth,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  hasCalendarToken,
  syncTodayToCalendar,
} from '../lib/calendarSync'
import { isValidWebhookUrl } from '../lib/webhook'
import { listProfiles, createProfile, switchActiveProfile, deleteProfile, getActiveProfileId } from '../lib/profiles'
import { todayKey } from '../lib/date'
import type { CompletedBehavior, DefaultView, Theme } from '../db/models'

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
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
    <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-700">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-white dark:bg-slate-900 shadow text-indigo-600 dark:text-indigo-400'
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
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [blocklistInput, setBlocklistInput] = useState('')
  const [permission, setPermission] = useState(notificationPermission())

  const [calendarConnected, setCalendarConnected] = useState(hasCalendarToken())
  const [calendarConnecting, setCalendarConnecting] = useState(
    () => !!new URLSearchParams(window.location.search).get('code'),
  )
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  const [webhookInput, setWebhookInput] = useState(settings.webhookUrl)
  const [webhookError, setWebhookError] = useState<string | null>(null)

  const [profileName, setProfileName] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const profiles = listProfiles()
  const activeProfileId = getActiveProfileId()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    completeGoogleCalendarAuth(code)
      .then(() => {
        setCalendarConnected(true)
        setCalendarError(null)
        window.history.replaceState({}, '', window.location.pathname)
      })
      .catch((err) => setCalendarError(err instanceof Error ? err.message : 'Connection failed.'))
      .finally(() => setCalendarConnecting(false))
  }, [])

  async function handleToggleReminders() {
    if (settings.remindersEnabled) {
      await updateSettings({ remindersEnabled: false })
      return
    }
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === 'granted') {
      await updateSettings({ remindersEnabled: true })
    }
  }

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

  function handleAddBlocklistDomain() {
    const domain = blocklistInput.trim().toLowerCase()
    if (!domain || settings.focusBlocklist.includes(domain)) {
      setBlocklistInput('')
      return
    }
    updateSettings({ focusBlocklist: [...settings.focusBlocklist, domain] })
    setBlocklistInput('')
  }

  async function handleConnectCalendar() {
    setCalendarError(null)
    setCalendarConnecting(true)
    try {
      await connectGoogleCalendar()
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : 'Connection failed.')
    } finally {
      setCalendarConnecting(false)
    }
  }

  function handleDisconnectCalendar() {
    disconnectGoogleCalendar()
    setCalendarConnected(false)
  }

  async function handleSyncCalendar() {
    setSyncStatus(null)
    setCalendarError(null)
    try {
      const day = await db.days.where('date').equals(todayKey()).first()
      const dayTasks = day ? await db.tasks.where('dayId').equals(day.id).toArray() : []
      const result = await syncTodayToCalendar(dayTasks)
      setSyncStatus(`Synced ${result.synced} task${result.synced === 1 ? '' : 's'}${result.failed ? `, ${result.failed} failed` : ''}.`)
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : 'Sync failed — retry')
    }
  }

  function handleWebhookBlur(value: string) {
    setWebhookInput(value)
    if (!isValidWebhookUrl(value)) {
      setWebhookError('Enter a valid http(s) URL.')
      return
    }
    setWebhookError(null)
    updateSettings({ webhookUrl: value })
  }

  function handleCreateProfile() {
    try {
      createProfile(profileName)
      setProfileName('')
      setProfileError(null)
      setStatus(`Profile "${profileName.trim()}" created. Switch to it to start using it.`)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not create profile.')
    }
  }

  async function handleDeleteProfile(id: string, name: string) {
    if (!window.confirm(`Delete profile "${name}"? This cannot be undone — all its data will be permanently removed.`)) return
    await deleteProfile(id)
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Settings</h2>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
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

        <SettingRow label="High-Contrast" hint="Strengthens muted text and borders to meet WCAG AA contrast.">
          <button
            type="button"
            onClick={() => updateSettings({ highContrast: !settings.highContrast })}
            aria-pressed={settings.highContrast}
            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
              settings.highContrast ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {settings.highContrast ? 'Enabled' : 'Enable'}
          </button>
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

        <SettingRow
          label="Enable Reminders"
          hint={
            !notificationSupported()
              ? 'Notifications are not supported in this browser.'
              : permission === 'denied'
                ? 'Denied — enable in browser settings'
                : 'Get notified about not-started tasks and empty days while the app is open.'
          }
        >
          <button
            type="button"
            onClick={handleToggleReminders}
            disabled={!notificationSupported() || permission === 'denied'}
            className={`px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-40 ${
              settings.remindersEnabled
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {settings.remindersEnabled ? 'Enabled' : 'Enable'}
          </button>
        </SettingRow>

        {settings.remindersEnabled && (
          <>
            <SettingRow label="Not-started reminder time" hint="Nudge if a task still has 0 progress by this time.">
              <input
                type="time"
                value={settings.notStartedThreshold}
                onChange={(e) => updateSettings({ notStartedThreshold: e.target.value })}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
              />
            </SettingRow>
            <SettingRow label="Empty-day nudge time" hint="Prompt to plan the day if nothing's been added yet.">
              <input
                type="time"
                value={settings.eveningNudgeTime}
                onChange={(e) => updateSettings({ eveningNudgeTime: e.target.value })}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
              />
            </SettingRow>
          </>
        )}

        <SettingRow label="Export data" hint="Download all goals, days, and tasks as a JSON file.">
          <button
            type="button"
            onClick={handleExport}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
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
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Import JSON
            </button>
          </>
        </SettingRow>

        <SettingRow label="Import CSV" hint="Bulk-create tasks for a chosen day from a title/minutesPerSubtask/totalSubtasks spreadsheet.">
          <button
            type="button"
            onClick={() => setCsvImportOpen(true)}
            className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Import CSV
          </button>
        </SettingRow>

        <SettingRow
          label="Automated backup"
          hint={
            settings.autoBackupEnabled && settings.lastAutoBackupAt
              ? `Last backup: ${new Date(settings.lastAutoBackupAt).toLocaleString()}`
              : 'Automatically downloads a full export on the interval below.'
          }
        >
          <div className="flex items-center gap-1.5">
            {settings.autoBackupEnabled && (
              <select
                value={settings.autoBackupIntervalDays}
                onChange={(e) => updateSettings({ autoBackupIntervalDays: Number(e.target.value) })}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
              >
                <option value={1}>Daily</option>
                <option value={7}>Weekly</option>
              </select>
            )}
            <button
              type="button"
              onClick={() => updateSettings({ autoBackupEnabled: !settings.autoBackupEnabled })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                settings.autoBackupEnabled ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {settings.autoBackupEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </SettingRow>
        {settings.autoBackupEnabled && settings.lastAutoBackupFailedAt && (settings.lastAutoBackupFailedAt > (settings.lastAutoBackupAt ?? 0)) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 pb-2">
            ⚠ The last automated backup failed ({new Date(settings.lastAutoBackupFailedAt).toLocaleString()}) — backups may not be running.
          </p>
        )}
      </div>
      {csvImportOpen && <ImportCsvModal defaultDate={todayKey()} onClose={() => setCsvImportOpen(false)} />}
      {status && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{status}</p>}

      <h2 className="text-lg font-bold mt-6 mb-3">Focus</h2>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Domains to avoid during a Focus Timer session. This list is saved for reference only — blocking a site
          while you're focused requires a browser extension, which isn't part of this app yet.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {settings.focusBlocklist.length === 0 && <span className="text-xs text-slate-400">No domains added yet.</span>}
          {settings.focusBlocklist.map((domain) => (
            <span
              key={domain}
              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center gap-1"
            >
              {domain}
              <button
                type="button"
                onClick={() => updateSettings({ focusBlocklist: settings.focusBlocklist.filter((d) => d !== domain) })}
                aria-label={`Remove ${domain} from blocklist`}
                className="text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={blocklistInput}
            onChange={(e) => setBlocklistInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddBlocklistDomain()
              }
            }}
            placeholder="e.g. twitter.com"
            className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <button
            type="button"
            onClick={handleAddBlocklistDomain}
            className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Add
          </button>
        </div>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-3">Integrations</h2>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
        <SettingRow
          label="Google Calendar"
          hint={
            !calendarConfigured()
              ? 'Not configured — set VITE_GOOGLE_CLIENT_ID to enable.'
              : calendarConnected
                ? 'Connected. Sync pushes today\'s incomplete tasks as calendar events sized to remaining minutes.'
                : 'Connect to push today\'s tasks onto your calendar.'
          }
        >
          <div className="flex items-center gap-1.5">
            {calendarConnected && (
              <button
                type="button"
                onClick={handleSyncCalendar}
                className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
              >
                Sync Today
              </button>
            )}
            <button
              type="button"
              onClick={calendarConnected ? handleDisconnectCalendar : handleConnectCalendar}
              disabled={!calendarConfigured() || calendarConnecting}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              {calendarConnecting ? (
                <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : calendarConnected ? (
                'Disconnect'
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </SettingRow>
        {(calendarError || syncStatus) && (
          <p className={`text-xs pb-2 ${calendarError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {calendarError ? (
              <>
                {calendarError}{' '}
                <button type="button" onClick={handleSyncCalendar} className="underline font-medium">
                  Retry
                </button>
              </>
            ) : (
              syncStatus
            )}
          </p>
        )}

        <SettingRow label="Webhook URL" hint="POSTs task title, totalMinutes, and completion time whenever a task reaches 100%.">
          <input
            type="url"
            defaultValue={webhookInput}
            key={settings.webhookUrl}
            onBlur={(e) => handleWebhookBlur(e.target.value)}
            placeholder="https://example.com/webhook"
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-56"
          />
        </SettingRow>
        {webhookError && <p className="text-xs text-red-600 dark:text-red-400 pb-2">{webhookError}</p>}
      </div>

      <h2 className="text-lg font-bold mt-6 mb-3">Profiles</h2>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
        {profiles.map((p) => (
          <SettingRow key={p.id} label={p.name} hint={p.id === activeProfileId ? 'Active' : undefined}>
            <div className="flex items-center gap-1.5">
              {p.id !== activeProfileId && (
                <button
                  type="button"
                  onClick={() => switchActiveProfile(p.id)}
                  className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Switch to
                </button>
              )}
              {p.id !== 'default' && (
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(p.id, p.name)}
                  className="text-slate-400 hover:text-red-600 text-xs"
                  aria-label={`Delete profile ${p.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          </SettingRow>
        ))}
        <div className="flex items-center gap-1.5 py-3">
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="New profile name (e.g. Work)"
            maxLength={40}
            className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
          />
          <button
            type="button"
            onClick={handleCreateProfile}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
          >
            + New Profile
          </button>
        </div>
        {profileError && <p className="text-xs text-red-600 dark:text-red-400 pb-2">{profileError}</p>}
      </div>

      <h2 className="text-lg font-bold mt-6 mb-3">Custom Fields</h2>
      <CustomFieldsSettings />
    </div>
  )
}
