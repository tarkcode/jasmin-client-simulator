# Jasmin Client SMS Simulator

A standalone, client-facing SMS sender tool used to test fake-DLR interception
on a Jasmin Web Panel deployment from the outside, exactly as a real client
HTTP integration would — without needing a second Jasmin stack or admin panel
access.

## What it does

`index.html` is a self-contained single-page tool (no backend required). It
POSTs to a Jasmin Web Panel's `/api/send/` endpoint with
`username`/`password`/`from`/`to`/`content`, the same way a real client
integration does. Features:

- Burst sending (send N messages in a row)
- Request log table with per-message latency
- CSV export of results
- FAKE / REAL badge classification based on the returned `msgid` prefix
  (`FAKE-<16 hex chars>` = intercepted fake DLR, anything else = real Jasmin
  msgid)

## Running locally

Option 1 (with proxy — recommended):
```bash
npm start
```
Open `http://localhost:3000` in your browser. The built-in proxy handles communication with the Jasmin API without CORS issues.

Option 2 (standalone):
Open `index.html` directly in a browser (`file://`).

## Deploying on Railway

When deployed on Railway (served over HTTPS at `https://<app>.up.railway.app`), browsers will block direct requests to `http://` Jasmin panel servers due to **Mixed Content** and **CORS** restrictions.

This repository includes a lightweight Node.js server (`server.js`) that solves this:
- Serves `index.html` on Railway's `$PORT`.
- Provides an `/api/proxy` endpoint that forwards requests server-to-server to the target Jasmin Web Panel.
- Completely avoids browser Mixed Content blocking and CORS issues.

Deployment steps:
1. Push this repo to GitHub.
2. In Railway, **New Project → GitHub Repository** → select this repo.
3. Railway auto-detects Node via Nixpacks and runs `npm start` (`node server.js`).
4. Open the generated `*.up.railway.app` URL. The "Route via server proxy" option is enabled automatically.

## Usage

1. Enter the target Jasmin Web Panel base URL, client username/password,
   `from`, `to`, and message content.
2. Set burst count if testing multiple sends.
3. Click send and watch the log table populate with FAKE/REAL badges and
   latency per request.
4. Export results to CSV if needed for a test report.
