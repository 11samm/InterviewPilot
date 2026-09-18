# 🎙️ InterviewPilot

**AI-powered mock interview coach with real-time voice conversation, webcam eye-contact tracking, and personalised coaching feedback.**

InterviewPilot puts you in a live voice-to-voice interview with a Gemini AI interviewer. While you speak, the app tracks your eye contact via webcam, counts your filler words, and measures your speaking pace — then grades every answered question against a rubric and generates targeted coaching the moment the session ends. Interviews and reports are saved server-side so you can reopen them later.

> For a deeper architecture walkthrough (data flow, endpoint contracts, security model), see [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## ✨ Features

- 🎤 **Voice-to-voice AI interviewer** — real-time conversation over the Gemini Live API using a short-lived, single-use token (no long-lived key ever reaches the browser)
- 👁️ **Live eye-contact tracking** — MediaPipe 478-point face mesh runs entirely in-browser via WebAssembly; it is an approximate coaching signal and never affects your content score
- 📊 **Live HUD** — filler-word counter, speaking pace (WPM), and camera gaze estimate updated in real time
- 🧠 **Per-question grading** — every asked question is graded independently with a score, verbatim evidence quote, and feedback; unanswered asked questions score zero, unreached questions are excluded
- 🔍 **Deep-dive drills** — one click generates a targeted practice exercise for any listed weakness
- 💾 **Persisted history** — completed and in-progress interviews are saved per browser session (SQLite) and can be reopened, retried, or deleted
- 🔁 **Resilient recording** — if analysis fails, the recorded transcript is preserved and can be retried without repeating the interview; a pending payload also survives a page refresh
- 🎛️ **Fully configurable** — role, company vibe, interview style (Behavioral / Technical / Case Study / System Design), difficulty, and question count

---

## 🖥️ Demo Flow

```
Setup → Live Interview → Processing → Results & Deep Dives
```

1. **Setup** — choose your role, company vibe, interview style, difficulty, and number of questions
2. **Interview** — click "Start Live Session" to begin voice conversation with the AI interviewer; your webcam runs eye-contact tracking in parallel (optional — a camera failure falls back to voice-only)
3. **Processing** — the backend grades your captured answers against the rubric using Gemini
4. **Results** — view your content score, speech/camera estimates, per-question feedback, and coaching improvements; expand any weakness for a personalised drill

---

## 🏗️ Architecture (high level)

```
Browser (Next.js 16 / React 19)
│
├── useLiveAPI ──────────────────────────────► Gemini Live API (WebSocket, v1beta)
│   └── audioUtils (PCM encode/decode/play)       ephemeral single-use token, server-issued
│
├── useFaceTracker ──────────────────────────► MediaPipe FaceLandmarker WASM (CDN)
│
└── lib/api.ts ──same-origin /api/* rewrite──► FastAPI backend

FastAPI (Python)
│
├── POST /api/session, GET /api/session      → access-code gated browser session (HttpOnly cookie)
├── POST /api/plan                            → PlannerService → Gemini (structured JSON)
├── POST /api/live-token                      → ephemeral, single-use Gemini Live token
├── POST /api/analyze                         → PresenceService (math) + SpeechService (math) + CoachService (LLM)
├── POST /api/deepdive                        → DeepDiveService → Gemini (structured JSON)
├── GET/PUT/DELETE /api/interviews[/:id]       → SQLite-backed history, owned by the session
└── SQLite (backend/data/interviews.sqlite3)   → sessions, drafts, completed reports
```

The **live voice conversation** goes directly browser → Gemini Live WebSocket, authenticated with a short-lived token the backend mints on demand. The backend is otherwise called for session/auth, planning, analysis, deep-dive drills, and history. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full request/response contracts and the security model (cookies, rate limits, CORS, origin checks).

---

## 🛠️ Tech Stack

### Frontend
| | |
|---|---|
| **Next.js 16** | React framework, same-origin `/api` rewrite to the backend |
| **React 19** | UI runtime |
| **TypeScript 5.7** | Type safety (build fails on type errors) |
| **Tailwind CSS v4** | Utility-first styling (configured via CSS, no config file) |
| **MediaPipe Tasks Vision** | In-browser face landmark detection (WASM) |
| **Gemini Live API** | Voice-to-voice WebSocket (v1beta), authenticated with an ephemeral token |
| **Vitest + Testing Library** | Frontend unit tests |
| **Radix UI / Lucide React** | Headless component primitives / icons |

### Backend
| | |
|---|---|
| **FastAPI** | Async HTTP framework |
| **Uvicorn** | ASGI server |
| **google-genai** | Official Gemini SDK (structured JSON output + Live ephemeral tokens) |
| **Pydantic** | Strict schema validation (extra fields forbidden, bounded sizes) |
| **SQLite** | Single-instance persistence for sessions/drafts/reports |
| **pytest** | Backend test suite |
| **Python 3.11+** | Runtime |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- A [Google AI Studio](https://aistudio.google.com/) API key. **The key lives only on the backend** — never in a `NEXT_PUBLIC_*` variable.

### 1. Clone & install the frontend

```bash
git clone https://github.com/11samm/InterviewPilot.git
cd InterviewPilot
npm install
```

### 2. Configure the frontend environment

```bash
cp .env.example .env.local
```

`.env.local` only needs a server-side URL for the Next.js `/api` proxy — there is no browser-visible Gemini key:

```env
# Server-only URL for Next.js /api proxy. No Gemini key belongs in frontend env.
BACKEND_URL=http://127.0.0.1:8000
```

### 3. Set up the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
```

`backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_LIVE_MODEL=gemini-3.8-live
APP_ENV=development
CORS_ORIGINS=http://localhost:3000
# Required for production; use a random code of at least 16 characters.
DEMO_ACCESS_CODE=
# Optional; mount this path on a persistent volume when deploying.
# DATABASE_PATH=/data/interviews.sqlite3
```

In `development`, opening the app auto-creates a private, cookie-based browser session with no access code needed. In `production` (`APP_ENV=production`), `GEMINI_API_KEY` and a `DEMO_ACCESS_CODE` of at least 16 characters are both required at startup, and session cookies are marked `Secure`.

### 4. Run both servers

**Backend** (from the repository root — important, not from inside `backend/`):
```bash
backend/.venv/Scripts/python.exe -m uvicorn backend.main:app --reload
```
→ `http://localhost:8000`

**Frontend** (from the repository root, in a separate terminal):
```bash
npm run dev
```
→ `http://localhost:3000`

**Verify:**
- App: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"ok"}`
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ✅ Tests & Checks

```bash
npm run typecheck                                    # TypeScript, no emit
npm test                                             # Vitest (frontend hooks/lib)
backend/.venv/Scripts/python.exe -m pytest backend/tests -q   # pytest (backend)
npm run lint                                         # ESLint
npm run build                                        # Next.js production build
```

All five run in CI on every push/PR (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

---

## 📁 Project Structure

```
InterviewPilot/
├── app/
│   ├── page.tsx                   # Entire UI — Setup, Interview, Processing, Results, Review screens
│   ├── layout.tsx                 # Root layout, fonts, analytics
│   ├── globals.css                # Tailwind v4 + dark-mode CSS variables
│   ├── components/
│   │   └── InterviewHistory.tsx   # History list (open/delete)
│   ├── hooks/
│   │   ├── useLiveAPI.ts          # Gemini Live WebSocket session manager
│   │   └── useFaceTracker.ts      # MediaPipe eye-contact tracking
│   └── lib/
│       ├── api.ts                 # Typed fetch wrappers to the FastAPI backend
│       ├── audioUtils.ts          # PCM audio encode / decode / playback helpers
│       ├── interviewRecording.ts  # Per-question transcript/timing accumulator
│       └── speechMetrics.ts       # Filler/word/pace calculation (mirrors backend/services/speech.py)
│
├── tests/                         # Vitest unit tests
│
└── backend/
    ├── main.py                    # FastAPI app entry point, CORS/origin/error handling
    ├── auth.py                    # Session cookie issuance/validation, access-code check
    ├── storage.py                 # SQLite sessions/drafts/reports + rate limiting
    ├── gemini.py                  # Shared Gemini client + generate_structured() helper
    ├── schemas.py                 # Pydantic request/response models (strict validation)
    ├── routers/                   # session, plan, analyze, deepdive, history, live
    ├── services/                  # planner, coach, presence, speech, deepdive
    └── tests/                     # pytest suite
```

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/session` | — | Whether the browser has an authenticated session and whether an access code is required |
| `POST` | `/api/session` | — | Create/reuse a browser session cookie (checks `DEMO_ACCESS_CODE` if configured) |
| `POST` | `/api/plan` | session | Generate interview questions and scoring rubric |
| `POST` | `/api/live-token` | session | Mint a single-use, model-constrained Gemini Live ephemeral token |
| `POST` | `/api/analyze` | session | Grade the completed interview (transcript + face metrics); idempotent for a completed interview ID |
| `POST` | `/api/deepdive` | session | Generate a targeted practice drill for a specific weakness |
| `GET` | `/api/interviews` | session | List this session's saved interviews (most recent 100) |
| `GET` | `/api/interviews/{id}` | session | Fetch one saved interview's payload/result |
| `PUT` | `/api/interviews/{id}` | session | Save/update a draft before analysis completes |
| `DELETE` | `/api/interviews/{id}` | session | Delete a saved interview |
| `GET` | `/health` | — | Backend health check |

Full request/response schemas are in [`ARCHITECTURE.md`](ARCHITECTURE.md) and the live Swagger UI at `/docs`.

---

## 🧩 How It Works

### Live interview session

When the user clicks **Start Live Session**:

1. The browser requests a single-use, 30-minute, model-constrained ephemeral token from `POST /api/live-token` (backend-authenticated with the real `GEMINI_API_KEY`, which never leaves the server).
2. A WebSocket opens directly from the browser to the Gemini Live API using that ephemeral token.
3. A script-based system prompt is sent — the model must call `set_question(index)` before reading each question (rejecting skipped/backward indices), then calls `end_interview()` after the closing line.
4. Mic audio is captured → resampled to 16kHz → encoded as base64 PCM → streamed to Gemini; silence and time spent listening to the interviewer are excluded from "speaking seconds."
5. Model audio arrives as base64 PCM chunks → decoded → queued for gapless playback via the Web Audio API.
6. Server-side transcription (`inputTranscription`) is appended to whichever question is currently marked active, so each answer is attributed to its own question.
7. On automatic completion (`end_interview`) or manual "Finish," the session waits briefly (drains queued audio/late transcript chunks) before tearing down — so a socket close never silently drops the last few words.

### Eye-contact tracking (optional)

MediaPipe's 478-point face mesh runs on every camera frame (throttled to ~200ms intervals):
- **Eye contact**: iris offset from eye center — `score = 1 - avgIrisOffset * 2`.
- A rolling window of recent samples drives the live indicator; one sample per second is stored for the final report.
- If the camera is unavailable or permission is denied, the interview continues voice-only and the report marks the camera metric `unavailable` rather than reporting a fabricated zero.

### Grading

After the session, `POST /api/analyze`:
1. **`PresenceService`** — averages the eye-contact samples into a single approximate score; this is a coaching signal only and never affects content grading.
2. **`SpeechService`** — deterministically counts a conservative filler-word list and computes words-per-minute from detected voice seconds (pace is withheld under 5 seconds of detected voice); the same word list and matching logic is mirrored on the frontend for the live HUD.
3. **`CoachService`** — sends only the rubric and the answered question/answer pairs to Gemini. The model must return one grade per answered question with a verbatim evidence quote copied from that answer; the backend rejects the response if evidence isn't found in the answer text, or if coverage doesn't exactly match the answered questions. Asked-but-unanswered questions score 0; questions never reached are excluded. The overall content score is the mean of included scores, computed in Python (not by the model).

---

## 🔐 Security & session model

- The browser never holds a permanent Gemini key; only a single-use, time-boxed Live token.
- Sessions are random tokens in `HttpOnly`, `SameSite=Lax` cookies (only their SHA-256 hash is stored); cookies last 30 days and are `Secure` in production.
- In production, an access code (`DEMO_ACCESS_CODE`, ≥16 chars) is required to open a new session, and `GEMINI_API_KEY` must be a real key at boot or the app refuses to start.
- History rows are isolated per session owner; one browser session cannot read or delete another's interviews.
- CORS origins are explicit (`CORS_ORIGINS`); browser-originated `POST`/`PUT`/`DELETE` requests with an unexpected `Origin` header are rejected.
- Per-owner/IP rate limits apply to login attempts, live-token minting, and analysis requests.

This is a **single-instance SQLite, browser-session model** — not full user accounts. There is no cross-device login, password reset, or account recovery; clearing cookies loses access to that session's history.

---

## 🗺️ Known limitations / roadmap

This section reflects the current, verified state (2026-09-17). See [`InterviewPilot_Upgrade_Action_Plan.md`](InterviewPilot_Upgrade_Action_Plan.md) and [`InterviewPilot_Resume_Upgrade_Roadmap.md`](InterviewPilot_Resume_Upgrade_Roadmap.md) for longer-term ideas — both carry a banner clarifying which parts are already done.

- **No concurrent in-progress analyze lock** — two overlapping `POST /api/analyze` calls for the same *incomplete* interview can both invoke the LLM before either result is saved (a completed result is idempotent and cannot be overwritten).
- **No history retention/cleanup** — old interview rows are not automatically pruned.
- **No recovery for a refresh during an active live recording** — a completed report or a pending (unanalyzed) payload survives a refresh; an in-progress live session does not.
- **Single-instance SQLite** — suitable for a demo/small deployment, not multi-instance/PostgreSQL-scale production. No hosted demo/deployment is currently configured.
- **Grading is not independently calibrated** — deterministic aggregation and evidence-checking prevent obviously invented output, but they do not establish that scores are consistent/fair across runs; there is no eval harness yet.
- **Live Gemini flow is implemented but not verified end-to-end against a real API key/microphone in this pass** (see [`ARCHITECTURE.md`](ARCHITECTURE.md) for exactly what was and wasn't exercised).
- Out of scope for the current pass: resume/job-description personalization, AI training/eval datasets, real user accounts/PostgreSQL.

---

## 📖 Detailed documentation

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full data-flow diagram, per-file breakdown, and verification status, and [`HANDOFF.md`](HANDOFF.md) for the implementation history of this cleanup pass.

---

## 📄 License

MIT
