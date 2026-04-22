# Google Play Store Publishing Guide — Artha-IQ (TWA)

Artha-IQ is a **Progressive Web App (PWA)**. The fastest and most maintainable way to
publish it on Google Play is as a **Trusted Web Activity (TWA)** using **PWABuilder.com**.

Every future update to your website is automatically live in the Play Store app
**without** needing to push a new APK.

---

## Prerequisites

1. **Google Play Developer Account** — one-time $25 USD fee at https://play.google.com/console
2. Icon PNG files uploaded to the repo root:
   - `icon-192.png` (192×192 px)
   - `icon-512.png` (512×512 px)
   - `icon-512-maskable.png` (512×512 px, with safe zone padding)
3. Your web app live at: `https://wealth.pithonix.ai`

---

## Step 1 — Create Icon PNG Files

Go to **pwabuilder.com/imageGenerator**, upload your logo image,
download the generated ZIP, and extract these files to the repo root:
- `icon-192.png`
- `icon-512.png`
- `icon-512-maskable.png`

Commit and push them to this branch, then redeploy on Vercel.

---

## Step 2 — Generate Android App via PWABuilder

1. Go to **pwabuilder.com**
2. Enter: `https://wealth.pithonix.ai`
3. Click **Build My PWA** → **Android**
4. Set:
   - Package ID: `ai.pithonix.wealthiq`
   - App name: `Artha-IQ — Pithonix AI`
   - Version: `1` / `1.0.0`
5. Click **Download**
6. Inside the ZIP, find:
   - `app-release-bundle.aab` ← upload to Play Store
   - The SHA-256 fingerprint shown on screen ← needed for assetlinks.json

---

## Step 3 — Update assetlinks.json

Open `.well-known/assetlinks.json` and replace the placeholder fingerprint
with the one from PWABuilder. Commit, push, and redeploy.

Verify at: `https://wealth.pithonix.ai/.well-known/assetlinks.json`

---

## Step 4 — Create Play Store Listing

1. https://play.google.com/console → **Create app**
2. Fill in the store listing using content from `store-listing.md`
3. Upload assets from `assets-checklist.md`
4. Complete Data Safety and Policy declarations

---

## Step 5 — Upload AAB and Submit

1. Release → Production → **Create new release**
2. Upload `app-release-bundle.aab`
3. Release notes: `Initial release of Artha-IQ 1.0.0`
4. Submit for review — expect **3–7 business days**

---

## Quick Reference

| Item | Value |
|---|---|
| Package ID | `ai.pithonix.wealthiq` |
| App name | `Artha-IQ — Pithonix AI` |
| Host URL | `https://wealth.pithonix.ai` |
| Privacy policy | `https://wealth.pithonix.ai/privacy` |
| Support email | `info@pithonix.ai` |
| Theme color | `#080d1a` |
| Version | `1.0.0` (code: `1`) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser bar visible inside app | `assetlinks.json` fingerprint mismatch |
| PWABuilder score too low | Ensure icon PNGs are live at the URLs in manifest.json |
| Play Store rejects — finance policy | Upload company registration certificate (CIN: U62090TS2026PTC213220) |
| App crashes on launch | Check that start URL returns HTTP 200 |
