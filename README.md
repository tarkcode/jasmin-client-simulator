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

Just open `index.html` directly in a browser. No build step, no server.

> Note: opening as `file://` or hosting on a different origin than the
> target Jasmin Web Panel will hit CORS restrictions unless the target
> server sends permissive CORS headers on `/api/send/`, or you launch
> Chrome with `--disable-web-security` against a throwaway profile for
> testing only.

## Deploying on Railway

This repo includes a minimal Node `serve` setup so Railway can host it as a
public URL (avoids `file://` CORS issues since requests then originate from
a real HTTPS origin):

1. Push this repo to GitHub.
2. In Railway, **New Project → GitHub Repository** → select this repo.
3. Railway auto-detects Node via Nixpacks and runs `npm start`, which serves
   `index.html` on the assigned `$PORT`.
4. Open the generated `*.up.railway.app` URL and point it at your Jasmin
   Web Panel's `/api/send/` endpoint.

## Usage

1. Enter the target Jasmin Web Panel base URL, client username/password,
   `from`, `to`, and message content.
2. Set burst count if testing multiple sends.
3. Click send and watch the log table populate with FAKE/REAL badges and
   latency per request.
4. Export results to CSV if needed for a test report.
