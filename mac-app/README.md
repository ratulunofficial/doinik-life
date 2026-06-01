# Doinik Life — macOS Desktop App

A native macOS wrapper around [doinik.life](https://doinik.life) built with
Electron. The app loads the live site, so **any change you push to the website
appears in the app automatically on next launch — no rebuild required**.

## What you get

- Native macOS window with traffic-light buttons, no browser address bar.
- Custom dock icon and "Doinik Life" app name.
- Universal `.dmg` installer (works on both Intel and Apple Silicon).
- All your data (tasks, expenses, mood, etc.) is persisted by the website's
  own storage, which is preserved across launches.

## How to get the `.dmg`

The DMG is built automatically by GitHub Actions on a real macOS runner —
you don't need a Mac to produce it.

### Option A — Trigger a build manually
1. Go to **Actions → Build macOS DMG → Run workflow** on GitHub.
2. After ~5 minutes, open the finished run and download the
   `Doinik-Life-macOS-DMG` artifact.
3. Unzip → double-click the `.dmg` → drag **Doinik Life** to **Applications**.

### Option B — Cut a release
1. Create a Git tag like `v1.0.0` and publish a GitHub Release.
2. The workflow attaches the `.dmg` directly to the release page.

## First launch on macOS

The DMG is **not code-signed** (signing requires a paid Apple Developer
account). The first time you open the app, macOS Gatekeeper will block it:

1. **Right-click** (or Control-click) the app in Applications → **Open**.
2. Confirm the dialog → the app launches and macOS remembers the choice.

If you later buy an Apple Developer ID, set these GitHub secrets and the
workflow will sign + notarize automatically:

- `CSC_LINK` — base64 of your `.p12` certificate
- `CSC_KEY_PASSWORD` — password for the `.p12`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for notarization

## Local development (only needed if you have a Mac)

```bash
cd mac-app
npm install
npm start         # run the app in dev mode
npm run dist      # build a .dmg for your current arch
```

## How the auto-update works

- The Electron window points at `https://doinik.life/` directly.
- HTTP cache is cleared on each launch.
- The website's own service worker (`service-worker.js`) is configured as
  network-first, so it always tries the network before falling back to the
  cached shell.
- Result: deploy → relaunch app → updated.

The desktop shell itself (this Electron wrapper) only needs to be rebuilt
when you change `main.js`, `package.json`, or the icon.
