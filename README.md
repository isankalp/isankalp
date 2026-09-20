# Goals Tracker

A personal goal tracker built around **subtasks × minutes per subtask** instead of a plain done/not-done flag, so any repeatable task (reading pages, solving questions, workout reps, coding units) is measured consistently in time invested and tracked at sub-task granularity.

## Modules

- **Daily Task Tracker** — add tasks to any day (title, minutes/subtask, total subtasks), edit completed subtasks live with a hard-clamped input, watch the row auto-strikethrough and move to a Completed section the instant it hits 100%, and see day-level minutes-planned-vs-done totals. Navigate freely between past and future days.
- **Goals** — group recurring task titles under a higher-level goal; progress rolls up total/done minutes across every matching task in history.
- **Stats & Streaks** — minutes planned vs. done charted daily/weekly/monthly, current & longest streak, and a per-task-title breakdown.
- **Calendar / History** — month view shaded by each day's percent of planned minutes completed; click a day to jump to its task list.
- **Settings** — default landing view, light/dark theme, whether completed tasks move to a separate section or just get struck through in place, browser reminder notifications, and JSON export/import for backup.
- **Habits** — a daily checklist pinned to the day view with per-habit current/longest streaks, computed from the habit's check-in history.
- **Templates / Recurring Tasks** — save a task as a reusable template, one-tap add it to any day, or auto-generate it on chosen weekdays going forward (never duplicated per day).
- **Priority** — tag tasks High/Medium/Low (defaults Medium), with day-view sort and filter.
- **Notes** — a free-text note per task, with an indicator on the row and persisting through completion.
- **Focus Timer** — a countdown for a task's `minutesPerSubtask`, prompting to mark a subtask complete when it ends.
- **Weekly/Monthly Review** — an auto-populated summary (minutes, tasks completed, streak) per period, with an editable reflection note, a history list, and PDF export.
- **Badges** — streak and cumulative-minutes milestones, auto-awarded once and shown in a view-only grid.
- **Weekly Planning Wizard** — suggests next week's tasks from goal-linked titles and their 4-week average pace; nothing is added until you accept.
- **Rollover** — prompts to carry yesterday's unfinished subtasks into today as a linked, tagged task.
- **Task dependencies** — a task can depend on another; it's locked (greyed, non-editable) until the dependency hits 100%, and unlocks automatically.
- **Insights** — auto-generated weekday patterns, a time-of-day completion chart, planned-vs-actual effort (via Focus Timer), and an energy-vs-completion correlation, each with its own empty/error state.
- **Named subtasks** — swap a plain count for a titled checklist; completion math stays identical either way.
- **Voice notes** — record and play back an audio note per task.
- **Integrations** — optional Google Calendar sync (OAuth, needs your own client ID) and a completion webhook, both with visible failure/retry.
- **Multi-profile** — fully separate datasets (own IndexedDB database) switchable from a header dropdown; goals can be archived without losing history; tasks can carry a color/icon category.
- **Quick-Add** — type or speak a line like "50 pages reading, 1 min each" to create a task instantly; unparseable input always falls back to the manual form pre-filled with whatever was recognized, and nothing saves until confirmed.
- **CSV Import** — bulk-create tasks from a spreadsheet with column mapping and a live preview; invalid rows are skipped individually and listed, nothing writes until you click Import.
- **Onboarding & Goal Templates** — a skippable first-run wizard that creates one goal and task while explaining the model, plus a searchable template library for common goals.
- **Custom Fields** — define extra text/number/dropdown fields for tasks, shown only in the task's detail panel; deleting a field keeps existing values unless you explicitly erase them.
- **Undo & History** — undo the last change (button or Ctrl/Cmd+Z), and reopen any task's edit history to restore a past version.
- **Automated backups** — an optional scheduled full export, with a visible warning in Settings if a backup run fails.
- **Keyboard shortcuts** — N to add a task, arrow keys to move between rows, Enter to increment, and `?` for a full shortcut reference.
- **Installable & offline** — installs as a PWA and keeps viewing/editing tasks fully working with no network connection.
- **Accessibility** — full keyboard operability, screen-reader labels on progress/completion controls, a High-Contrast mode, and no state conveyed by color alone.
- **Custom Units** — a task can be measured in Minutes, Pages, Reps, Dollars, or a user-typed custom unit instead of always minutes; day/stats totals are grouped and shown separately per unit, never summed across incompatible ones.
- **Contribution Heatmap** — a private, GitHub-style yearly grid shaded by each day's percent complete, filterable by unit or category/tag.
- **Privacy** — a dedicated Export All Data (every table, one JSON file) and a double-confirmation Delete All My Data that irreversibly wipes this browser's local copy.
- **Language** — English, Spanish, and Hindi for navigation, Settings, and the add-task form, with untranslated strings falling back to readable English and user-entered content (titles, notes) never translated.
- **Capacity Planning** — an optional daily or weekly minutes budget; adding a task that would push the day/week past it shows a non-blocking warning, and a progress bar tracks planned-vs-available. Off by default — no warnings unless you set a budget.
- **Progress Photo Evidence** — attach a photo to any subtask completion (optional, never blocks the increment if it fails), view a task's photos chronologically, and compare two side by side.
- **Bulk Task Operations** — multi-select tasks on a day to move, duplicate (reset to 0 progress), tag, or delete them together; bulk delete requires a count-specific confirmation and is undoable.
- **Time-Blocking view** — drag tasks from an Unscheduled sidebar onto an hourly grid, resize/reposition blocks with 15-minute snapping, and see overlapping blocks flagged and laid out side by side so every block stays clickable.
- **Accounts** *(optional, needs setup — see below)* — real Sign Up / Log In (email+password or Google), password reset by email, changing your email or password from Settings, and an unverified-email banner that never blocks task tracking. Entirely hidden when no backend is configured, so the app stays fully local-first by default.
- **Local-to-account migration** — the first time you log in on a device with existing local data, you're offered a one-time backup upload of everything (same format as Export All Data) to your account before continuing; your on-device data is never touched or deleted by this.

## Skipped this round

Some requested features need a real backend, multi-user accounts, or a native app this project doesn't have, and were skipped rather than faked: public/shared profiles or leaderboards, a template marketplace, community challenges, a mentor/coach dashboard, health-app sync, notification-digest emails, and smartwatch companions. Each was scoped out explicitly rather than half-built.

Accounts are the one exception — real Sign Up/Log In/password reset/session management now exist, backed by [Supabase](https://supabase.com) (see **Accounts setup** below). The local-to-account migration is scoped down from a full relational sync to a single backup-file upload: your local data is never deleted, converted, or merged automatically. Login lockout after repeated failures is enforced client-side only (a real server-side rate limit isn't something a static SPA can add on its own) — an honest limitation, not a security guarantee.

## Data model

`Task` stores `minutesPerSubtask`, `totalSubtasks`, and `completedSubtasks` (clamped `0..totalSubtasks`); `totalMinutes`, `minutesDone`, `percentComplete`, and `isComplete` are all derived, never stored as raw truth. Each `Task` belongs to a `Day` (`YYYY-MM-DD`); `Goal`s optionally link a set of task titles to aggregate across days.

## Stack

React + TypeScript + Vite + Tailwind CSS v4, local-first persistence via IndexedDB ([Dexie.js](https://dexie.org/)) — no backend required for task tracking. Charts via [Recharts](https://recharts.org/). Client-side routing via React Router. Accounts (optional) are backed by [Supabase](https://supabase.com) (`@supabase/supabase-js`), loaded on demand so it adds nothing to the bundle when unconfigured.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run unit tests (math + streak logic)
npm run build    # typecheck + production build
npm run lint      # oxlint
```

Data lives entirely in the browser's IndexedDB. Use Settings → Export/Import to back up or move data between browsers.

## Accounts setup (optional)

Sign Up / Log In / password reset are hidden entirely until configured — nothing else in the app changes if you skip this section.

1. Copy `.env.example` to `.env.local` and create a free project at [supabase.com](https://supabase.com).
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
3. For "Continue with Google", create an OAuth client in Google Cloud Console (same one used for Calendar sync works), then enable the Google provider under Supabase → Authentication → Providers and add that client's ID/secret there.
4. For the local-to-account data migration's backup upload, create a Storage bucket named `account-backups` in your Supabase project, with a policy that lets an authenticated user read/write only paths under their own `auth.uid()`.
5. Set the same env vars on your host (e.g. Vercel → Project Settings → Environment Variables) for deploys.
