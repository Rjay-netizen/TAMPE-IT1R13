# Totoo AI

A web prototype for the study **"Development of an AI-Based System for Fake News and Deepfake Detection in Filipino Digital Content"** (Group 10 — Ledesma, Fellesco, Tampe).

Totoo AI screens Filipino, Taglish and English text, images and videos for misinformation and deepfake indicators, and returns a **0–100 risk score with the exact signals behind it**.

**Live demos:**
- https://rjay-netizen.github.io/TAMPE-IT1R13/ — `TAMPE-IT1R13`
- https://tamperhianjay16-arch.github.io/ai-fake-news-deepfake-detector/ — public mirror

---

## Run it

### Option 1 — built-in server (no installs)

```bash
cd C:\Users\Acer\totoo-ai
node serve.js
```

Open <http://localhost:5500>.

### Option 2 — VS Code Live Server

1. Install the **Live Server** extension (`ritwickdey.LiveServer`).
2. Right-click `index.html` → **Open with Live Server**.

### Option 3 — any static host

The site is plain HTML/CSS/JS with no build step. Drop the folder on Netlify, Vercel, GitHub Pages or any static host.

---

## Pages

| File | Purpose |
|---|---|
| `index.html` | Landing page with a live text demo |
| `detector.html` | Text / image / video analysis console |
| `dashboard.html` | Local scan history, verdict mix, literature benchmarks |
| `about.html` | Background, research questions, objectives, scope, limitations |
| `references.html` | The study's sources and verification resources |

## Structure

```
totoo-ai/
├── index.html
├── detector.html
├── dashboard.html
├── about.html
├── references.html
├── serve.js              zero-dependency static server
├── css/styles.css        design system
├── js/
│   ├── engine.js         detection engine (swappable interface)
│   ├── samples.js        Filipino / Taglish demo posts
│   ├── auth.js           demo accounts, sessions, header state
│   ├── login.js          login page controller
│   ├── store.js          localStorage scan history (per account)
│   ├── main.js           shared UI behaviour
│   ├── detector.js       detector page controller
│   └── dashboard.js      dashboard page controller
└── assets/favicon.svg
```

## How detection works

`js/engine.js` exposes three functions:

```js
TotooEngine.analyzeText(text)   // → { score, verdict, signals[], highlights[] }
TotooEngine.analyzeImage(file)  // → { score, verdict, signals[], facts[] }
TotooEngine.analyzeVideo(file)  // → { score, verdict, signals[], facts[] }
```

**Text signals:** sensational wording · source attribution · emotional intensity · formatting red flags · vague hedging (`daw`, `umano`, `kuno`, `reportedly`) · verifiability.

**Media signals:** provenance metadata (EXIF/C2PA) · container/extension integrity · editing & generator fingerprints · geometry and compression profile · bitrate and audio track (video).

**Thresholds:** `0–39` likely authentic · `40–64` suspicious · `65–100` strong manipulation indicators.

### Important

The engine is a **transparent heuristic prototype**, not a trained neural network. It exists so the study's workflow, confidence reporting and evaluation interface can be demonstrated end-to-end. Replace the three functions above with calls to a hosted DistilBERT / CNN-LSTM / multimodal transformer and the rest of the site keeps working unchanged.

## Demo authentication

Dashboard access uses a **client-side demo login** — there is no server here, so it cannot be real security.

- Passwords are salted and hashed with **PBKDF2-SHA256** (120,000 iterations) through the Web Crypto API; plain-text passwords are never stored.
- Accounts live in this browser's `localStorage` (`totoo_ai_users_v1`); the session lives in `localStorage` or `sessionStorage` depending on *Keep me signed in*.
- Visitors can create their own account on `login.html`. There is no preset password.
- Only `dashboard.html` requires a session. The detector and every other page stay public.
- Each account gets its own scan history (`totoo_ai_history_v1:<user id>`); guest scans stay under the original `totoo_ai_history_v1` key.

> **Not production security.** Because everything runs in the browser, anyone with developer tools can bypass the session flag. Use Supabase, Firebase or a small API before storing real credentials.

## Privacy

All analysis runs in the browser. Files are never uploaded. Scan history is stored in `localStorage` and can be cleared or exported as JSON from the dashboard. Signed-in histories are namespaced per account; guest scans stay under `totoo_ai_history_v1`.

## Disclaimer

A supplementary verification aid only. It does not guarantee truthfulness and is not a substitute for professional fact-checking. Confirm results with VERA Files, Tsek.ph, Rappler Fact Check or PCIJ.
