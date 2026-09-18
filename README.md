# Goals Tracker

A simple, self-contained web app for setting goals, tracking progress, and marking them complete. No build step, no backend — just open `index.html`.

## Features

- Add goals with a title, description, category, and due date
- Track progress with a percentage slider
- Mark goals complete/active
- Filter by all / active / completed
- Overview stats (total, active, completed)
- Data persists locally in the browser (`localStorage`)

## Usage

Open `index.html` in a browser, or serve the directory with any static file server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Stack

Plain HTML, CSS, and JavaScript — no dependencies or build tooling required.
