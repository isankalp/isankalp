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

## Data model

`Task` stores `minutesPerSubtask`, `totalSubtasks`, and `completedSubtasks` (clamped `0..totalSubtasks`); `totalMinutes`, `minutesDone`, `percentComplete`, and `isComplete` are all derived, never stored as raw truth. Each `Task` belongs to a `Day` (`YYYY-MM-DD`); `Goal`s optionally link a set of task titles to aggregate across days.

## Stack

React + TypeScript + Vite + Tailwind CSS v4, local-first persistence via IndexedDB ([Dexie.js](https://dexie.org/)) — no backend required. Charts via [Recharts](https://recharts.org/). Client-side routing via React Router.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run unit tests (math + streak logic)
npm run build    # typecheck + production build
npm run lint      # oxlint
```

Data lives entirely in the browser's IndexedDB. Use Settings → Export/Import to back up or move data between browsers.
