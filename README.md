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
- **Cloud data sync** *(optional, needs setup — see below)* — once logged in, every module (tasks, goals, habits, templates, reviews, badges, custom fields, photos, voice notes, time-blocking, everything) reads and writes to your account instead of this browser's local storage, so your data follows you to any device you log into, live (changes on one device/tab show up on another without a refresh). Logged out — or accounts not configured at all — the app is exactly the local-first, single-device experience it always was. Requires a network connection while logged in; there's no offline mode for the cloud-synced state.
- **Local-to-account migration** — the first time you log in on a device with existing local data, you're offered a one-time import that copies everything into your account (so it becomes part of your cloud data from then on), plus a JSON backup snapshot attached to the account as an extra safety net. Your on-device data is never deleted or altered by this either way.
- **AI features** *(optional, needs your own Claude API key — see below)* — invisible everywhere until a key is added in Settings → AI:
  - **AI Goal Breakdown** — describe a goal in plain language, or upload a syllabus/reading-list PDF, and get a proposed, fully editable task list (with a non-blocking pace-feasibility check against your own history) — nothing saves until you confirm.
  - **AI-Powered Quick Capture** — an AI fallback for Quick-Add phrasing the built-in parser can't handle, a free-form command bar ("move all my reading tasks this week to Friday") that always shows an exact preview before executing, and AI tag suggestions on new tasks (always overridable, never silently saved).
  - **AI Recaps & Diagnosis** — a narrative weekly recap and a streak-break diagnosis, each grounded strictly in your own logged numbers — every figure the AI states is checked against the real data it was given, and the response is discarded (never shown) if it states anything that doesn't match.
  - **Ask AI** — a chat panel over your own task/journal history, every answer citing the specific dates it drew from (tap through to the day), explicitly saying so rather than guessing when something isn't in your history.
  - **Journal & Journal Coaching** — a simple daily journal entry, plus a tone-calibrated coaching note and recurring-theme surfacing once you have enough entries — both read only what you actually wrote, never inferring an unstated mood. Independently toggleable off in Settings → AI even with AI otherwise enabled.
- **Dashboard** — a customizable home page (today's progress, streak, remaining-task count, reorderable/hideable Goals & Habits widgets, a pending-tasks list) alongside the existing day view (now a "Tasks" tab). New accounts land here by default; existing users' saved default view is untouched.
- **Spotify Focus Integration** *(optional, needs your own Spotify app + setup — see below)* — invisible everywhere until connected in Settings → Integrations:
  - **Account connection** — standard OAuth; the refresh token and your app's client secret never reach the browser, only a short-lived access token fetched on demand.
  - **In-app playback & mini-player** — starts a chosen playlist during a Focus Timer session via the Web Playback SDK, with a persistent mini-player (track, play/pause, skip, dismiss) while it's running.
  - **Task-type playlist profiles** — map a task category to a playlist (plus one default) in Settings → Focus Music; Focus Timer pre-selects it, never auto-plays.
  - **Deep Work playlist generation** — creates a real new private playlist in your own Spotify account, seeded from focus-oriented search terms.
  - **Session listening recap** — shows the tracks actually played once a Focus Timer session ends.
  - **Music/focus insights** — a Stats → Insights chart comparing on-pace-vs-planned time for sessions with music vs without, once there's enough of each.
  - **Do Not Disturb pairing** — mutes this app's own reminder notifications while Spotify focus music is playing (there's no web API for real OS-level DND, so this is honestly scoped to what a browser tab can control).
- **Lifestyle Tracking** — a "Lifestyle" entry point (top bar, or the Dashboard widget) opens a daily log for user-defined metrics, independent of tasks:
  - **Custom fields** — define Yes/No, Duration, or Number fields with a success threshold (Yes/No's expected value and optional count cap; Duration/Number's min/max range), reorderable, editable, and deletable (deleting only hides a field going forward — its past logged entries stay intact and viewable).
  - **Sleep-style duration auto-calculation** — a Duration field can auto-calculate from two labeled time inputs (e.g. Sleep Time/Wake Time) instead of direct entry, correctly handling overnight wraparound (wake numerically earlier than sleep means the next day) with a same-day override for naps, and rejecting a zero-length identical-times entry.
  - **Frozen-at-save evaluation** — each day's entry is evaluated against the field's threshold *at save time* and that pass/fail result is stored with it, so editing a field's threshold later only ever affects future entries, never rewriting a day you already logged.
  - **Lifestyle Calendar** — a month view, separate from the Task Calendar, colored green only when every configured field passed that day, red if even one failed or was left blank, and neutral if you never opened that day at all.
- **Task Calendar** *(color rule rewritten this round)* — a day is now green only once every task on it is 100% complete, and red the instant even one isn't (never a percent gradient anymore); a day's aggregate completion percent — summed across every task's subtasks regardless of unit — shows separately in the day block's tooltip/detail, distinct from its binary color, and appears on the Dashboard's today card too. A future day with a scheduled-but-unstarted task is red exactly like a past one — timing never overrides incompleteness.
- **Grid** — a dedicated full-page "Grid" tab (never a modal/popup) for spreadsheet-style habit/task tracking: rows grouped into named, collapsible sections, with a date-column header (weekday + date, today highlighted) that scrolls horizontally with no fixed boundary in either direction. The row-label column stays pinned during that scroll.
  - **Sections** — create, rename inline, reorder, and collapse/expand independently of one another; deleting one requires a confirmation naming exactly how many rows it will take with it, and removes every one of those rows' checkbox history — there's no upper limit on how many sections you can have.
  - **Rows** — add to a section (starts empty/unchecked across every date), rename inline (checkbox history untouched), reorder within a section or move to a different one (history follows the row either way), and delete (with the same row-count-style confirmation, permanently erasing its checkbox history). Duplicate row names within a section are allowed, never blocked — just flagged with a small warning icon.
  - **Checkbox cells** — click any date's cell, past, present, or future, to toggle it; every toggle saves immediately, with no separate save step and no drift on reload. Shift-click a second cell in the same row to bulk-fill (or bulk-clear) the whole date range between the two clicks in one go, and each row shows a live current-streak or 30-day completion count next to its label.
  - **View preferences** — a compact/comfortable density toggle, a jump-to-date control, and a one-section filter, all restored exactly as you left them the next time you open the Grid.

## Skipped this round

Some requested features need a real backend, multi-user accounts, or a native app this project doesn't have, and were skipped rather than faked: public/shared profiles or leaderboards, a template marketplace, community challenges, a mentor/coach dashboard, health-app sync, notification-digest emails, and smartwatch companions. Each was scoped out explicitly rather than half-built.

Accounts are one exception — real Sign Up/Log In/password reset/session management, and now full cloud data sync across every module, backed by [Supabase](https://supabase.com) (see **Accounts setup** below). Login lockout after repeated failures is enforced client-side only (a real server-side rate limit isn't something a static SPA can add on its own) — an honest limitation, not a security guarantee. The cloud-synced state also has no offline mode: every read/write goes straight to your account, so it needs a live network connection while you're logged in (local-first, offline-capable behavior is exactly what you get logged out).

AI features are the other exception — real Claude API calls (see **AI setup** below), bring-your-own-key. "Grounded in your own data" is enforced as best it can be from the client: every number an AI recap/diagnosis states is checked against the real figures it was given and discarded if it doesn't match, and Q&A/breakdown prompts only ever see the specific data assembled for that request — but an LLM's output still can't be *guaranteed* perfectly grounded the way a database query can, so treat AI-stated figures as a best-effort summary of your real data, not the source of truth (that's always Stats/Calendar). The AI request-usage counter in Settings is this app's own count, not a verified read of your Anthropic billing dashboard, since there's no browser-safe API for that.

Spotify Focus Integration is the third — real OAuth, in-app playback, and playlist generation (see **Spotify Focus Integration setup** below), needing your own Spotify Premium account and a Spotify app registration. Two honest limitations: in-app playback needs a Web Playback SDK access token in the browser by design (Spotify's own architecture), so "no access token ever used client-side" isn't literally achievable — what's actually enforced is that the *refresh token* and *client secret* never leave the server (see that section's architecture note); and "Do Not Disturb pairing" only mutes this app's own notifications, since no web API can toggle real OS-level Do Not Disturb.

## Data model

`Task` stores `minutesPerSubtask`, `totalSubtasks`, and `completedSubtasks` (clamped `0..totalSubtasks`); `totalMinutes`, `minutesDone`, `percentComplete`, and `isComplete` are all derived, never stored as raw truth. Each `Task` belongs to a `Day` (`YYYY-MM-DD`); `Goal`s optionally link a set of task titles to aggregate across days.

## Stack

React + TypeScript + Vite + Tailwind CSS v4, local-first persistence via IndexedDB ([Dexie.js](https://dexie.org/)) — no backend required for task tracking. Charts via [Recharts](https://recharts.org/). Client-side routing via React Router. Accounts (optional) are backed by [Supabase](https://supabase.com) (`@supabase/supabase-js`), loaded on demand so it adds nothing to the bundle when unconfigured. AI features (optional) call the Claude API directly from the browser with your own key — no extra dependency, no server of this app's own involved. Spotify Focus Integration (optional) uses Supabase Edge Functions (Deno) for everything token-sensitive, and loads the Spotify Web Playback SDK script at runtime only once connected — neither adds anything to the bundle otherwise.

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

Sign Up / Log In / password reset / cloud sync are hidden entirely until configured — nothing else in the app changes if you skip this section.

1. Copy `.env.example` to `.env.local` and create a free project at [supabase.com](https://supabase.com).
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
3. Run `supabase/schema.sql` once in your project's SQL Editor (Dashboard → SQL Editor → New query, paste, run). This creates the one table every account's data lives in once logged in, with row-level security so each account only ever sees its own rows, and turns on Realtime so changes sync live across devices/tabs.
4. For "Continue with Google", create an OAuth client in Google Cloud Console (same one used for Calendar sync works), then enable the Google provider under Supabase → Authentication → Providers and add that client's ID/secret there.
5. For the local-to-account migration's backup-snapshot safety net, create a Storage bucket named `account-backups` in your Supabase project, with a policy that lets an authenticated user read/write only paths under their own `auth.uid()`.
6. Set the same env vars on your host (e.g. Vercel → Project Settings → Environment Variables) for deploys.

**Architecture note**: every local table (tasks, days, goals, habits, ...) maps onto one generic `records` table in Postgres (`user_id`, `table_name`, `id`, `data jsonb`), rather than one SQL table per model. This means the schema never needs to change when a model gains a field, at the cost of losing native per-column SQL querying — acceptable for this app's per-user, personal-scale data. Voice notes and completion photos (which hold raw binary `Blob`s locally) are stored as inline base64 data URLs in that same `data` column rather than a separate object-storage upload, again trading some payload size for one simple, consistent code path.

## AI setup (optional)

Every AI feature is hidden entirely until configured — nothing else in the app changes if you skip this section.

1. Get a Claude API key from [console.anthropic.com](https://console.anthropic.com).
2. In the app, go to Settings → AI, paste the key, and save (it's validated with a live request before being stored).
3. That's it — Break Down with AI, the free-form command bar, AI Quick-Add, AI recaps/diagnosis, Ask AI, and Journal Coaching all become available immediately.

**Architecture note**: the key is stored the same way as the rest of your settings — locally in this browser, or synced to your account's cloud data if you're also logged in (Epic 58/AK-1's "stored securely" means RLS-protected like your other cloud data when logged in, or browser-local storage otherwise — there's no separate encryption layer beyond that). It's used directly from the browser via `fetch()` to `https://api.anthropic.com`, using Anthropic's own documented `anthropic-dangerous-direct-browser-access` header for exactly this bring-your-own-key pattern — never sent to, or proxied through, any server of this app's own. It's masked (e.g. `sk-ant...ab12`) in the UI after saving and never shown in full again; use Replace/Remove Key in Settings to change or clear it.

## Spotify Focus Integration setup (optional)

Needs both Accounts (above) and a Spotify Premium account (in-app playback requires it) — everything under Settings → Integrations/Focus Music is hidden until configured.

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Note its Client ID and Client Secret (rotate the secret immediately if it's ever been pasted anywhere other than your own terminal/secrets manager).
2. In your Spotify app's settings, add a Redirect URI of exactly `<your Supabase project URL>/functions/v1/spotify-oauth-callback`.
3. Run `supabase/spotify_schema.sql` once in your Supabase project's SQL Editor. This creates `spotify_connections` with **no** client-facing row-level-security policies at all — only the Edge Functions below (using the service-role key) can ever read or write it, so a refresh token can't reach the browser even by a client-side bug.
4. Deploy the five Edge Functions in `supabase/functions/` with the Supabase CLI: `supabase functions deploy spotify-start spotify-oauth-callback spotify-token spotify-status spotify-disconnect`.
5. Set their secrets (see `supabase/functions/.env.example` for what each one is): `supabase secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... SPOTIFY_STATE_SECRET=... APP_URL=...`. Never paste the Client Secret into chat, a commit, or anywhere but this command in your own terminal.
6. In the app, go to Settings → Integrations and connect Spotify.

**Architecture note**: the literal "no access token used client-side" reading of a Spotify integration isn't achievable — the Web Playback SDK that plays audio in-browser fundamentally needs one. What's actually enforced instead: the long-lived refresh token and the Client Secret never leave the `spotify-token` Edge Function; the browser only ever holds a short-lived access token, fetched on demand and refreshed server-side before it expires. The OAuth `state` param is HMAC-signed by `spotify-start` so `spotify-oauth-callback` — reached via a plain top-level redirect from Spotify with no session of its own — can recover which Supabase user started the flow without trusting anything unverified.
