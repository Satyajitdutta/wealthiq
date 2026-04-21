# Google Play Store Publishing Guide — WealthIQ (TWA)

WealthIQ is a **Progressive Web App (PWA)**. The fastest and most maintainable way to
publish it on Google Play is as a **Trusted Web Activity (TWA)** — a thin native Android
wrapper that loads your existing website in a Chrome custom tab with no browser UI.

Every future update to your website is automatically live in the Play Store app
**without** needing to push a new APK.

---

## Prerequisites

1. **Google Play Developer Account** — one-time $25 USD fee
   - Sign up at https://play.google.com/console
2. **Java 11+** installed (`java -version`)
3. **Node.js 14+** installed (`node -v`)
4. **Android SDK** — install via Android Studio or `sdkmanager`
5. Your web app live at a public HTTPS URL (e.g. `https://wealthiq.pithonix.ai`)

---

## Step 1 — Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
bubblewrap --version
```

---

## Step 2 — Generate the Android Project

Navigate to the `google-play/` folder and run:

```bash
cd google-play
bubblewrap init --manifest https://wealthiq.pithonix.ai/manifest.json
```

Bubblewrap will read your `manifest.json` from the live URL and prompt you for:
- **Package ID**: `ai.pithonix.wealthiq`  ← use this exact value
- **App name**: `WealthIQ — Pithonix AI`
- **Launcher name**: `WealthIQ`
- **App version code**: `1`
- **App version name**: `1.0.0`
- **Signing key path**: `./android.keystore`  ← Bubblewrap will generate this
- **Signing key alias**: `wealthiq`

> A reference config is already saved in `bubblewrap.config.json`.

---

## Step 3 — Build the APK / AAB

```bash
# Inside google-play/ after init
bubblewrap build
```

This produces:
- `app-release-bundle.aab` — upload this to Play Store (preferred)
- `app-release-signed.apk` — for testing on a device

---

## Step 4 — Get the SHA-256 Fingerprint

After building, Bubblewrap prints the signing fingerprint. You can also get it:

```bash
keytool -list -v -keystore ./android.keystore -alias wealthiq
```

Copy the **SHA-256** value. It looks like:
`AB:CD:EF:12:34:...`

---

## Step 5 — Update assetlinks.json

Open `.well-known/assetlinks.json` (in the repo root) and replace the placeholder:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "ai.pithonix.wealthiq",
    "sha256_cert_fingerprints": ["AB:CD:EF:12:34:..."]  ← paste your fingerprint here
  }
}]
```

Commit and deploy this file. Verify it is live at:
`https://wealthiq.pithonix.ai/.well-known/assetlinks.json`

> **This step is critical.** Without a valid assetlinks.json the browser bar will show
> inside your app, breaking the full-screen TWA experience.

**NOTE:** The vercel.json rewrites do not currently serve `.well-known/assetlinks.json`.
See Step 5b below to add the route.

### Step 5b — Add assetlinks route to vercel.json

Add the following to the `rewrites` array in `vercel.json`:

```json
{ "source": "/.well-known/assetlinks.json", "destination": "/.well-known/assetlinks.json" }
```

And add a header entry so it serves the correct MIME type:

```json
{
  "source": "/.well-known/assetlinks.json",
  "headers": [
    { "key": "Content-Type", "value": "application/json" },
    { "key": "Cache-Control", "value": "public, max-age=3600" }
  ]
}
```

---

## Step 6 — Verify TWA Link (optional but recommended)

```bash
bubblewrap validate --url https://wealthiq.pithonix.ai
```

Should output: `Digital Asset Links verified successfully`

---

## Step 7 — Create Play Store Listing

1. Go to https://play.google.com/console → **Create app**
2. Fill in:
   - App name: `WealthIQ — Pithonix AI`
   - Default language: English (India)
   - App or game: App
   - Free or paid: Free
3. Complete the **Store Listing** using content from `store-listing.md`
4. Upload assets from `assets-checklist.md`
5. Set **Privacy Policy URL**: `https://wealthiq.pithonix.ai/privacy`

---

## Step 8 — Upload the AAB

1. Go to **Release → Production** (or start with **Internal Testing**)
2. Click **Create new release**
3. Upload `app-release-bundle.aab`
4. Write release notes, e.g. `Initial release — WealthIQ 1.0.0`
5. Click **Save → Review release → Start rollout**

---

## Step 9 — Complete Policy Declarations

Google requires you to fill in:
- **Target audience**: Adults (18+)
- **Data safety form**: Declare what data you collect (email, financial data, payments)
  - Email → collected, encrypted, shared with Resend
  - Financial data → collected, encrypted, not shared
  - Payment info → not collected (handled by Razorpay)
- **Financial features declaration**: Since this is a finance app, Google may ask for
  additional verification. Have your company registration (CIN: U62090TS2026PTC213220)
  details ready.

---

## Step 10 — Wait for Review

- Initial review: **3–7 business days** for new apps
- Subsequent updates: usually **a few hours**
- Monitor status in Play Console → **Inbox / Policy** for any issues

---

## Keeping the App Updated

Since this is a TWA, **your website IS the app**. Any changes to your Vercel deployment
are live immediately — no Play Store update needed.

You only need to push a new AAB when:
- You change the package name, icons, or splash screen
- You bump the `appVersion` code (required by Play Store for binary updates)
- You add new Android-level permissions or features

---

## Quick Reference

| Item | Value |
|---|---|
| Package ID | `ai.pithonix.wealthiq` |
| App name | `WealthIQ — Pithonix AI` |
| Launcher name | `WealthIQ` |
| Host URL | `https://wealthiq.pithonix.ai` |
| Privacy policy | `https://wealthiq.pithonix.ai/privacy` |
| Support email | `info@pithonix.ai` |
| Theme color | `#080d1a` |
| Version | `1.0.0` (code: `1`) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser bar visible inside app | `assetlinks.json` not found or fingerprint mismatch |
| Build fails — SDK not found | Set `ANDROID_HOME` env variable to your SDK path |
| `bubblewrap init` fails | Ensure your manifest.json URL is publicly reachable |
| Play Store rejects app — finance policy | Upload company registration certificate |
| App crashes on launch | Check that start URL returns HTTP 200 |
