# Deploy StructCalc to GitHub Pages

This folder is a ready-to-publish static site (ASCE 7-22 + NBCC 2015 snow
calculators, app shell, robots.txt, noindex tags already in place).

## 1. Push to GitHub (using GitHub Desktop)

1. Install **GitHub Desktop**: https://desktop.github.com — install and sign
   in with your GitHub account (one-time setup; this also configures git
   credentials so future pushes never ask for a password again).
2. In GitHub Desktop: **File → Add local repository** → browse to
   `D:\Serhii\Standards and Codes\Codes\structcalc-site` → **Add repository**.
   - If it says "This directory does not appear to be a Git repository",
     click **create a repository** instead — it will turn this folder into
     a git repo in place (keep all existing files).
3. In the left "Changes" panel you'll see all files listed. At the
   bottom-left, type a summary like `Initial commit` and click
   **Commit to main**.
4. Click **Publish repository** (top toolbar).
   - Name it (e.g. `structcalc`).
   - **Uncheck** "Keep this code private" if you want GitHub Pages to work
     on the free plan (Pages on private repos needs GitHub Pro). The site
     itself stays non-indexed thanks to `robots.txt` + `noindex` either way.
   - Click **Publish repository**.

## 2. Enable GitHub Pages

1. On GitHub, go to the repo → **Settings → Pages**.
2. Under "Build and deployment" → Source: **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**. Save.
4. After ~1 minute the site will be live at:
   `https://<your-username>.github.io/structcalc/`

It will redirect automatically to `StructCalc/index.html` (the app shell).

## 3. Search-engine indexing

Already handled — `robots.txt` (Disallow: /) and `<meta name="robots"
content="noindex, nofollow">` are present on every page, so search engines
won't index the site. The repo/site itself is still reachable by anyone with
the direct link (GitHub Pages sites are public). If you want it truly
private, that requires a paid GitHub plan + private repo Pages, or a
different host with password protection — let me know if you want that
instead.

## 4. Updating later

After any future edits to the calculators:

1. Open **GitHub Desktop** — it will automatically show the changed files
   under "Changes".
2. Type a short summary (e.g. `Update NBCC module`) and click
   **Commit to main**.
3. Click **Push origin** (top toolbar).

GitHub Pages redeploys automatically within ~1 minute. No passwords or
commands needed — GitHub Desktop remembers your login from step 1.
