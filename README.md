# Doinik Life v2 (React)

A rebuild of `../index.html` using **Vite + React 19 + TypeScript + Tailwind 4 + Motion**, installable as a **PWA**.
The original `index.html` is untouched. Both versions can be used with the same account.

## Run / build

```bash
npm install          # first time only
npm run dev          # http://localhost:5173  (add ?demo to try it with fake data, nothing is saved)
npm run build        # production files go to dist/
npm run preview      # serve dist/ locally to test the real build + offline mode
```

Deploy: upload the **contents of `dist/`** to any static host (Firebase Hosting, Netlify, GitHub Pages…).
The build uses relative paths, so it also works from a sub-folder.
Add the new domain under *Firebase console → Authentication → Settings → Authorized domains*, or login will fail there.

## Same data as the old app

| | old `index.html` | v2 |
|---|---|---|
| Firebase path | `users/<username>/<key>` | same |
| value format | JSON string per key | same |
| keys | `day_Y-M-D`, `loans_data`, `mood_data`, `bazar_data`, `permanent_tasks`, `notes_data`, `orders_data`, `waterGoal` | same, nothing extra |
| how it saves | re-uploads **every** key on each change (`set`) | uploads **only the changed key** (`update`) |
| startup | waits for Firebase | paints instantly from a local cache, then syncs |

⚠️ While you still use both: the old app's save overwrites the whole account with what *its* browser
has cached. Keep the old one open in only one place, and let it finish syncing before editing in v2.

## What's where

- `src/lib/firebase.ts` — auth, username claim logic (ported 1:1), granular sync
- `src/lib/sync.ts` — write queue, offline pending edits, local cache
- `src/lib/data.ts` — all app rules (carry-over tasks, permanent tasks, bazar → expense, loans, orders undo/redo)
- `src/features/*` — one folder per screen
- Email Filter drafts stay in the browser only (`dl2_email_filter_draft`), never synced.
- Weather (`src/lib/weather.ts`) uses Open-Meteo (free, no key). Only the chosen place's coordinates are sent;
  the place and a 30-minute cache are kept in this browser (`dl2_weather_place`, `dl2_weather_cache_v1`).
