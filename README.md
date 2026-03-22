# 🎙️ InterviewPilot

**AI-powered mock interview coach with real-time voice conversation, webcam eye-contact tracking, and personalised coaching feedback.**

InterviewPilot puts you in a live voice-to-voice interview with a Gemini AI interviewer. While you speak, the app tracks your eye contact via webcam, counts your filler words, and measures your speaking pace — then grades your performance and generates targeted coaching the moment the session ends.

---

## ✨ Features

- 🎤 **Voice-to-voice AI interviewer** — real-time conversation powered by the Gemini Live API (no typing, no delays)
- 👁️ **Live eye-contact tracking** — MediaPipe 478-point face mesh runs entirely in-browser via WebAssembly
- 📊 **Live HUD** — eye contact %, filler word counter, speech pace WPM, and speaking status badge updated in real time
- 🧠 **AI coaching report** — confidence score, 3 strengths, 3 areas to improve, and a narrative summary
- 🔍 **Deep-dive drills** — one click generates a targeted 5–10 min practice exercise for any weakness
- 🎛️ **Fully configurable** — role, company vibe, interview style (Behavioral / Technical / Case Study / System Design), difficulty, and question count
- 🌑 **Dark mode only** — sleek dark UI with a purple/green accent palette

---

## 🖥️ Demo Flow

```
Setup → Live Interview → Processing → Results & Deep Dives
```

1. **Setup** — choose your role, company vibe, interview style, difficulty, and number of questions
2. **Interview** — click "Start Live Session" to begin voice conversation with the AI interviewer; your webcam runs eye-contact tracking in parallel
3. **Processing** — the backend grades your transcript against the rubric using Gemini
4. **Results** — view your confidence score, strengths, and coaching improvements; expand any weakness for a personalised drill

---

## 🏗️ Architecture

```
Browser (Next.js 16 / React 19)
│
├── useLiveAPI ──────────────────────────────► Gemini Live API (WebSocket, v1beta)
│   └── audioUtils (PCM encode/decode/play)       gemini-2.5-flash-native-audio-preview
│
├── useFaceTracker ──────────────────────────► MediaPipe FaceLandmarker WASM (CDN)
│
└── lib/api.ts ──────────────────────────────► FastAPI backend (localhost:8000)

FastAPI (Python)
│
├── POST /api/plan      → PlannerService  → Gemini (gemini-2.5-flash-lite, structured JSON)
├── POST /api/analyze   → PresenceService (math) + CoachService (LLM)
└── POST /api/deepdive  → DeepDiveService → Gemini (gemini-2.5-flash-lite, structured JSON)
```

The **live voice conversation** goes directly browser → Gemini Live WebSocket. The backend is only called for planning (before), grading (after), and deep-dive drills (on demand).

---

## 🛠️ Tech Stack

### Frontend
| | |
|---|---|
| **Next.js 16** | React framework |
| **React 19** | UI runtime |
| **TypeScript 5.7** | Type safety |
| **Tailwind CSS v4** | Utility-first styling (configured via CSS, no config file) |
| **MediaPipe Tasks Vision** | In-browser face landmark detection (WASM) |
| **Gemini Live API** | Voice-to-voice WebSocket (v1beta, direct from browser) |
| **Radix UI** | Headless component primitives |
| **Lucide React** | Icons |
| **Vercel Analytics** | Usage tracking |

### Backend
| | |
|---|---|
| **FastAPI** | Async HTTP framework |
| **Uvicorn** | ASGI server |
| **google-genai** | Official Gemini SDK (structured JSON output) |
| **Pydantic** | Schema validation |
| **Python 3.11+** | Runtime |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- A [Google AI Studio](https://aistudio.google.com/) API key (one key works for both — or use two separate ones)

### 1. Clone & install frontend

```bash
git clone https://github.com/your-username/InterviewPilot.git
cd InterviewPilot
npm install
```

### 2. Configure frontend environment

```bash
cp .env.example .env.local
```

`.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Set up the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

`backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run both servers

**Frontend** (from project root):
```bash
npm run dev
```
→ `http://localhost:3000`

**Backend** (from project root — important: run from root, not inside `backend/`):
```bash
uvicorn backend.main:app --reload
```
→ `http://localhost:8000`

**Verify:**
- App: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"ok"}`
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📁 Project Structure

```
InterviewPilot/
├── app/
│   ├── page.tsx                   # Entire UI — Setup, Interview, Processing, Results screens
│   ├── layout.tsx                 # Root layout, fonts, analytics
│   ├── globals.css                # Tailwind v4 + dark-mode CSS variables
│   ├── hooks/
│   │   ├── useLiveAPI.ts          # Gemini Live WebSocket session manager
│   │   └── useFaceTracker.ts      # MediaPipe eye-contact + head-pose tracking
│   └── lib/
│       ├── api.ts                 # Typed fetch wrappers to the FastAPI backend
│       └── audioUtils.ts          # PCM audio encode / decode / playback helpers
│
└── backend/
    ├── main.py                    # FastAPI app entry point
    ├── gemini.py                  # Shared Gemini client + generate_structured() helper
    ├── schemas.py                 # Pydantic request/response models
    ├── routers/                   # plan.py, analyze.py, deepdive.py
    └── services/                  # planner, coach, presence, speech, deepdive
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/plan` | Generate interview questions and scoring rubric |
| `POST` | `/api/analyze` | Grade the completed interview (transcript + face metrics) |
| `POST` | `/api/deepdive` | Generate a targeted practice drill for a specific weakness |
| `GET` | `/health` | Backend health check |

Full request/response schemas are in [`ARCHITECTURE.md`](ARCHITECTURE.md) and the live Swagger UI at `/docs`.

---

## 🧩 How It Works

### Live Interview Session

When the user clicks **Start Live Session**:

1. A WebSocket opens to the Gemini Live API using the browser-side API key
2. A strict script-based system prompt is sent — the AI greets the candidate, asks each question in order, waits silently for answers, and calls an `end_interview()` function tool when done
3. Mic audio is captured → resampled to 16kHz → encoded as base64 PCM → streamed to Gemini
4. Model audio arrives as base64 PCM chunks → decoded → queued for gapless playback via Web Audio API
5. Server-side transcription (`inputTranscription` / `outputTranscription`) feeds the live transcript display

### Eye Contact Tracking

MediaPipe's 478-point face mesh runs on every camera frame (throttled to 200ms intervals):
- **Eye contact**: measures iris offset from eye center — `score = 1 - avgIrisOffset * 2`
- **Head pitch/yaw**: derived from nose and chin landmark positions
- One `FaceMetric` sample is stored per second; a rolling 25-sample average drives the live indicator

### Grading

After the session, the backend:
1. **`PresenceService`** — averages eye contact and posture scores from all face metric samples (`presence = eye_contact × 0.6 + posture × 0.4`)
2. **`CoachService`** — sends the transcript, rubric, and objective signals to Gemini for strict grading (vague answers score below 50; 70+ requires specific, well-structured responses with concrete examples)

---

## 🗺️ Roadmap / Known Limitations

- [ ] **`SpeechService` is a stub** — returns hardcoded filler/WPM values; real server-side speech analysis not yet implemented (client-side counts are used in the UI)
- [ ] **No persistence** — session data lives in React state and is lost on refresh; a database would enable history and progress tracking
- [ ] **CORS is localhost-only** — update `allow_origins` in `backend/main.py` before deploying
- [ ] **CoachService analyses first two questions only** — sessions with 3–4 questions have remaining questions ungraded individually
- [ ] **`InterviewerService` is a pass-through** — placeholder for future question formatting/persona logic

---

## 📖 Detailed Documentation

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for:
- Full system architecture diagram
- Per-file deep-dives for every hook and service
- Complete API request/response examples
- Environment variable reference
- Dev setup instructions

---

## 📄 License

MIT
