# Squad Stats

Static Fortnite stats page. A GitHub Action fetches stats from fortnite-api.com every 30 minutes and commits `data/stats.json` and `data/history.json`; `index.html` just reads those files.

## Setup
1. Push this repo to GitHub.
2. Settings → Secrets and variables → Actions → add `FORTNITE_API_KEY` (the key from dash.fortnite-api.com, used as-is).
3. Settings → Pages → deploy from the `main` branch, root folder.
4. Actions tab → "Update stats" → Run workflow to populate data immediately.
5. Edit `players.json` to add friends (`accountType`: `epic`, `psn` or `xbl`). Each player must have career stats set to public in Fortnite's privacy settings.

## Local test
```
FORTNITE_API_KEY=your-key node scripts/fetch-stats.mjs
python3 -m http.server
```
