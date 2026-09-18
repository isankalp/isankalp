# Goals Tracker

A personal goal tracker built around **subtasks × minutes per subtask** instead of a plain done/not-done flag, so any repeatable task (reading pages, solving questions, workout reps, coding units) is measured consistently in time invested and tracked at sub-task granularity.

## Modules

- **Daily Task Tracker** — add tasks to any day (title, minutes/subtask, total subtasks), edit completed subtasks live with a hard-clamped input, watch the row auto-strikethrough and move to a Completed section the instant it hits 100%, and see day-level minutes-planned-vs-done totals. Navigate freely between past and future days.
- **Goals** — group recurring task titles under a higher-level goal; progress rolls up total/done minutes across every matching task in history.
- **Stats & Streaks** — minutes planned vs. done charted daily/weekly/monthly, current & longest streak, and a per-task-title breakdown.
- **Calendar / History** — month view shaded by each day's percent of planned minutes completed; click a day to jump to its task list.
- **Settings** — default landing view, light/dark theme, whether completed tasks move to a separate section or just get struck through in place, and JSON export/import for backup.

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
