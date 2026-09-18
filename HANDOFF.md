# InterviewPilot — implementation handoff and next steps

Updated: 2026-09-17. Branch: `main`. All work is local and uncommitted.

## User request and stopping point

The user asked to fix the issues identified in the README and two roadmap documents, excluding AI training/evaluation and resume/job-description interviewing, then write a Markdown current-state/next-steps document.

During implementation, the user asked to preserve usage by creating a detailed handoff for a lower-usage model. This file is that handoff. **Implementation is written but not fully verified or ready to call complete.** Continue the changes already present; do not recreate the project or restart the investigation.

Repository: `D:\Samuel\Downloads\Code\InterviewPilot`
Remote: `https://github.com/11samm/InterviewPilot.git`

No commits, pushes, deployments, paid services, real Gemini requests, or real microphone/camera sessions have been performed during this implementation.

## Read these files first

1. This document.
2. `git diff --stat` and `git status --short` for the working tree.
3. `app/hooks/useLiveAPI.ts` and `app/page.tsx` for the new end-to-end flow.
4. `backend/schemas.py`, `backend/services/coach.py`, and `backend/routers/analyze.py`.
5. The focused regression tests in `tests/` and `backend/tests/`.

The three original Markdown files were read fully:
- `README.md`
- `InterviewPilot_Upgrade_Action_Plan.md`
- `InterviewPilot_Resume_Upgrade_Roadmap.md`

They describe the old implementation. They have NOT yet been updated. The referenced `ARCHITECTURE.md` is still missing.

## What was wrong in the original code

- SpeechService always returned 12 fillers, 248 words, 142 WPM and a made-up speech score.
- The browser and backend calculated different metrics from different timing information.
- The browser's speaking timer counted all time when the interviewer was silent, including candidate silence.
- CoachService only supplied questions 1 and 2, with one combined candidate transcript and no answer-to-question mapping.
- Results displayed an unexplained model-generated confidence score.
- Missing camera samples produced a zero presence score, which was then sent to the model as if it were poor performance.
- Browser code used a permanent NEXT_PUBLIC_GEMINI_API_KEY.
- Completing or ending an interview called teardown, which erased the transcript before submission.
- Analysis failures returned users to a new interview instead of letting them retry the captured recording.
- Camera setup and microphone setup could leak resources when asynchronous permission requests completed after cancellation.
- No persistence, usable CI, test suite, or working lint setup. Next builds ignored TypeScript errors.
- CORS was localhost-only, and upstream errors could be returned verbatim.
- Original dependencies contained reported vulnerabilities.

## Changes already written

### Recording and live interview

Files: `app/hooks/useLiveAPI.ts`, `app/lib/interviewRecording.ts`, `app/lib/audioUtils.ts`

- Replaced the large hook with a smaller explicit lifecycle.
- Recording survives stop and disconnect; only a new interview resets it.
- Candidate answers are stored per question with text, asked status, and estimated speaking seconds.
- Added the Gemini tool `set_question(question_index)`. The model is instructed to call this before asking each question.
- Rejects skipped, out-of-range and backward question markers. Repeated markers are idempotent.
- Candidate audio energy is measured locally. Silent buffers and buffers during queued interviewer playback do not increment speaking time.
- Uses a simple RMS threshold of 0.015, explicitly an estimate rather than calibrated voice activity detection.
- Counts audio buffer duration rather than timer ticks.
- Audio contexts, tracks, processors, socket handlers and timers are released on stop/unmount.
- Pending microphone permission resolutions are stopped if the session was cancelled.
- Playback audio sources are tracked and stopped when interrupted.
- Automatic completion waits briefly for final transcription and queued audio.
- Unexpected disconnect preserves the recording and exposes a save/analyze action.
- Browser requests an ephemeral token from the backend; permanent API key is absent from frontend code/env templates.

### Speech and camera metrics

Files: `app/lib/speechMetrics.ts`, `backend/services/speech.py`, `backend/services/presence.py`, `app/hooks/useFaceTracker.ts`

- Deterministic word/phrase matching on both client and server.
- Conservative possible-filler list: um, uh, erm, hmm, you know, i mean, sort of, kind of.
- Ordinary words such as like/right/yeah are excluded to avoid flagging normal uses.
- WPM = words / estimated candidate voice seconds * 60, rounded to one decimal.
- Pace is unavailable for an empty transcript or fewer than five seconds of detected voice.
- Removed fabricated speech composite score.
- No camera samples -> available false, null gaze score, zero samples.
- Presence remains an approximate average camera-gaze metric. It does not affect content grades.
- Nullable live gaze indicator, no fake fallback for incomplete landmarks, camera permission/error cleanup and cancellation handling.
- Pinned MediaPipe WASM CDN to 0.10.33, matching the package version.
- Added `types/mediapipe.d.ts` because the package's conditional exports prevented TypeScript from resolving its published declarations.

### Grading and validation

Files: `backend/schemas.py`, `backend/services/coach.py`, `backend/services/planner.py`

- AnalyzeInput requires an interview UUID and exactly one ordered answer entry per planned question.
- Bounds input sizes, durations, metrics and question counts; forbids extra fields and nonfinite floats.
- Rejects speaking time greater than interview duration.
- Backend derives the combined transcript and speaking time from answer entries.
- Coach receives all answered question/answer pairs.
- Each grade contains the question index, score, verbatim evidence and feedback.
- Validates exact coverage of answered questions, no duplicates, and evidence present in the corresponding answer.
- Missing/invalid coverage or invented evidence returns a retryable error instead of publishing a misleading report.
- Asked but unanswered questions receive zero; not-asked questions receive null and are excluded.
- Overall content score is calculated in Python from included scores.
- No camera/speech metrics are passed into content grading.
- No LLM call when there are no recorded answers.
- Planner now checks that generated question count equals requested count.

### Backend security and configuration

Files: `backend/auth.py`, `backend/routers/live.py`, `backend/main.py`, `backend/gemini.py`, `next.config.mjs`, environment examples

- Browser uses same-origin Next.js `/api` rewrites to FastAPI.
- Server-only BACKEND_URL config (default http://127.0.0.1:8000).
- Backend owns GEMINI_API_KEY.
- `POST /api/live-token` creates a model-constrained, single-use token with one minute to begin and 30-minute expiry.
- Browser connects to v1beta BidiGenerateContentConstrained with access_token.
- GEMINI_LIVE_MODEL defaults to gemini-3.8-live; GEMINI_MODEL defaults to gemini-2.5-flash-lite. Both are configurable.
- Backend browser sessions use random tokens in HttpOnly SameSite=Lax cookies; only hashes are stored.
- Production requires a DEMO_ACCESS_CODE of at least 16 characters and GEMINI_API_KEY; cookies are Secure.
- Development allows creating a private browser session without a code.
- API routes require the session cookie.
- SQLite-backed per-session/request rate limits, plus limits for login attempts and live-token creation.
- CORS origins are configurable and explicit; rejects browser writes with unexpected Origin.
- Private API responses marked no-store.
- Upstream exception strings are no longer exposed.
- Gemini request timeout set to 90 seconds; browser request timeout 120 seconds.
- Restored TypeScript build errors instead of ignoreBuildErrors.

Current official ephemeral-token documentation was consulted:
https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
It currently documents v1beta, access_token, single-use tokens and model constraints. The installed SDK 2.24.0 contains older v1alpha wording in warnings/docstrings, although its token method allows the configured version. **The live integration is not verified against a real key.** If it fails, inspect the current documented REST request and the actual SDK serialization, not old forum snippets.

### Persistence and UI

Files: `backend/storage.py`, `backend/routers/history.py`, `app/components/InterviewHistory.tsx`, `app/page.tsx`, `app/lib/api.ts`

- Added SQLite session/draft/report storage, with configurable DATABASE_PATH.
- Defaults to backend/data/interviews.sqlite3, ignored by Git.
- History records are isolated by browser-session owner.
- Completed interviews cannot be replaced by a different payload.
- Repeating analysis of the same completed payload returns the saved result.
- Draft is saved before the AI call, so failures remain recoverable.
- GET/list/detail, PUT draft and DELETE history routes.
- History list and report reopening; pending interviews reopen for retry.
- Recent content score sequence, with warning that different questions are not directly comparable.
- Browser sessionStorage backup of the pending analysis payload for refresh recovery.
- Results show speech metrics, optional camera metric, per-question grades/evidence/captured answers and the documented aggregate rule.
- Renamed confidence score to Interview content score.
- Deep-dive failures now display a retryable error.
- Setup & history navigation and access-code gate.

This is **single-instance SQLite persistence with browser-session access**, not PostgreSQL or full user accounts. It is an intentional usable baseline that needs honest documentation. Browser cookies last 30 days; clearing them removes access. There is no cross-device login, account recovery, or migration to PostgreSQL yet.

### Tooling and dependencies

- Next.js updated from 16.2.0 to 16.3.5 in response to npm audit.
- Compatible vulnerable transitive packages updated with npm audit fix.
- npm audit reported **0 vulnerabilities** after the fixes.
- Added ESLint 9 + matching eslint-config-next, Vitest, jsdom, Testing Library, and browser speech recognition type definitions.
- Added npm typecheck and test scripts.
- Added GitHub Actions workflow: lint, typecheck, frontend tests, backend tests, build.
- Backend dependencies pinned to installed versions; development requirements include pytest/httpx.
- Local Python venv exists at backend/.venv.
- Frontend dependencies are installed.
- Added ignore patterns for Python caches, SQLite data, tsbuildinfo and debug logs.
- Note: already tracked generated files are still tracked; .gitignore does not remove them.

## Verification at handoff

- Backend: **24 tests passed**, using:
  `backend/.venv/Scripts/python.exe -m pytest backend/tests -q`
- Three dependency deprecation warnings under local Python 3.14; tests still pass.
- npm audit after compatible updates: **0 vulnerabilities**.
- ESLint: **0 errors, 6 warnings**.
  - Four newly unused imports in app/page.tsx: FaceMetric, Mic, Eye, Activity.
  - Two existing actionTypes warnings in the duplicate use-toast files.
- Typecheck and frontend tests: see the final verification note below.
- Production build: not run yet.
- Browser smoke test: not run yet.
- Real Gemini voice/token/grading test: not run yet.
- CI workflow exists but has not run remotely.
- No deployment was attempted.

An earlier typecheck found MediaPipe import resolution and missing browser speech-recognition types. The shim and @types/dom-speech-recognition were then added; the final rerun is the one to trust.

## Finish in this order

### 1. Resolve verification failures before extending anything

Run:
```powershell
Set-Location -LiteralPath 'D:\Samuel\Downloads\Code\InterviewPilot'
npm run typecheck
npm test
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
npm run lint
npm run build
```

Read the current results first; do not reinstall everything. Remove the four unused page imports. Fix actual test/build failures without disabling the checks. Existing compiler-only lint rules are disabled because this app does not enable React Compiler; ordinary hook dependency checks remain active.

Expected frontend tests cover:
- Phrase/word metric matching and insufficient audio.
- Ignoring silence and AI playback.
- Per-question attribution and detached recording snapshots.
- Recording survives manual stop and automatic completion.
- Recording survives unexpected disconnect.
- Pending microphone permissions are cleaned up after cancellation.

Expected backend tests cover:
- Real metrics and missing camera.
- Payload validation.
- All questions graded and deterministic aggregate.
- Missing/duplicate/unsupported model evidence rejected.
- Empty/unasked questions.
- Session authentication, access codes, history ownership and deletion.
- Failed analyses preserve drafts.
- Completed data cannot be overwritten.
- Origin checks and ephemeral token constraints/rate limits.

### 2. Inspect these remaining integration risks

These are review items, not confirmed passing behavior:

- In main page analyze(), refreshHistory() is inside the same try block as successful analysis. If refreshing history fails AFTER results are set and pending is cleared, the catch can switch to review with pending=null and display a blank screen. Separate successful analysis from optional history refresh.
- React Strict Mode may run initialize() twice; concurrent unauthenticated POST /session calls can create different session cookies. Make initial session establishment single-flight/idempotent and test the flow.
- If live startup fails while camera setup succeeds, stop camera tracking or offer explicit stop. Check all failed-start/early-exit paths.
- Manual Finish immediately stops the websocket. Final transcription chunks may still be in flight. Consider a short audio-end/flush grace period before snapshotting without clearing recorded data.
- Question attribution relies on the model calling set_question correctly and transcription arriving in order. Verify with multiple questions, an interruption, early finish and late transcript chunks. Unassigned transcript is currently ignored; if the model skips its first marker, do not silently give a misleading score.
- Confirm partial input transcription fragments concatenate correctly; current recorder appends raw text without inserting extra spaces.
- Confirm ephemeral token request and websocket setup actually work together with the current model/API. The unit test mocks the SDK token request; it does not prove provider compatibility.
- Validate default model availability for the user's account or configure GEMINI_LIVE_MODEL. Do not silently fall back to exposing a permanent key.
- Check Next.js rewrite timeout behavior for slower 90-second backend AI calls.
- Repeated concurrent analyze requests can still duplicate LLM work before a result exists; saved completed requests are idempotent, in-progress requests do not yet have a lock.
- Camera metrics are heuristics. Head-angle fields remain from the original hook but no longer influence the report. Do not present them as calibrated measurements.
- History/session expiration does not yet remove old interview rows. Define retention/cleanup before public production use.
- Refresh during an active live recording is not recovered. Pending analysis and completed reports are recovered; active-session incremental draft saving is not implemented.
- SQLite browser sessions are a demo baseline. Production deployment needs a persistent volume, configured access code and actual HTTPS/same-origin smoke test.

Do not broaden into a new platform migration during this cleanup pass.

### 3. Smoke-test the finished flow

Start backend from repository root:
```powershell
backend/.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Start frontend separately:
```powershell
npm run dev
```

Use backend/.env.example and root .env.example. No permanent Gemini key should appear in NEXT_PUBLIC variables.

Verify:
- Backend down -> retryable frontend connection message.
- Setup, exact planned question count.
- Mic denied and camera denied separately.
- Camera failure permits voice-only interview.
- At least three questions with distinct answers.
- Finish early: not reached != unanswered.
- Automatic completion preserves all answer text.
- Results include all asked questions and real speech stats.
- Failed analysis can retry without repeating interview.
- Refresh after completed analysis retains history.
- Different browser sessions cannot view each other's reports.
- Delete history actually removes the record.
- Client bundle/requests contain only the temporary token, not the permanent key.

If no valid key or hardware/browser access is available, explicitly document that the live flow remains unverified. Do not report it as tested.

### 4. Update documentation and deployment support

- Rewrite README to match the new setup, access-code behavior, session/history limitations, scoring formula, temporary token flow and test commands.
- Fix the clone URL to https://github.com/11samm/InterviewPilot.git.
- Create the missing ARCHITECTURE.md with the actual browser -> Next proxy -> FastAPI -> SQLite / Gemini flow.
- Update both roadmap files or add a clear current-status pointer at the top so old limitations are not mistaken for current facts.
- Add a backend Dockerfile/deployment instructions if needed; none written yet.
- Document environment requirements: APP_ENV=production, DEMO_ACCESS_CODE, GEMINI_API_KEY, CORS_ORIGINS, BACKEND_URL, persistent DATABASE_PATH, HTTPS.
- Add real user accounts/PostgreSQL to future steps unless the user explicitly wants that additional work now.
- Do not claim a hosted demo exists; hosting credentials/target are not configured or verified.
- Remove already tracked build/cache artifacts from Git only after confirming exact paths. Existing tracked tsconfig.tsbuildinfo changed during typecheck; nested backend __pycache__ artifacts were present in the original repo.
- Replace this handoff's pending status with actual final check results and remaining limitations.
- Show the user the resulting Markdown file and concise completion summary. Do not automatically commit/push/deploy.

## Out of scope for this pass

- AI training, labeled evaluation datasets, eval runners, model benchmarking.
- Resume upload/parsing, job-description personalization.
- Unrelated AI features and UI redesign.
- Creating a new task or deploying to an unspecified account.
- Claiming validated scoring accuracy: deterministic aggregation and evidence checks do not establish grading calibration.

## Windows execution notes

The default sandbox could not traverse D:\Samuel\Downloads even though the project was listed writable, and exec_command initially ran in C:\ despite workdir. Successful commands used explicit Set-Location -LiteralPath and require_escalated. File reads/writes and dependency installs were approved by automatic review. Avoid unnecessary permission questions; the user already authorized these fixes.

Files were written via Python executed in a literal PowerShell here-string. The project Python environment is local; do not depend on globally installed pytest. No other agent has worked on this task.

## Suggested continuation prompt

Read HANDOFF.md and continue the existing uncommitted InterviewPilot fixes. First collect/fix the frontend typecheck, tests and build, then address the specific integration risks in the handoff. Keep AI training/evaluation and resume/JD interviewing out of scope. Finish the README, ARCHITECTURE.md and current-state/next-steps documentation. Verify what you can and accurately label any live Gemini or deployment checks you cannot perform. Do not restart from scratch or add more features.


## Final verification note before stopping

The already-running verification command completed successfully after this handoff was written:

- `npm run typecheck`: **passed** (no TypeScript errors).
- `npm test`: **9 tests passed across 2 files**.
- `npm run lint`: **0 errors, 6 warnings**, as listed above.
- `python -m pytest backend/tests -q` in the project venv: **24 passed**.
- `npm audit fix` finished with **0 reported vulnerabilities**.
- Vitest emitted a future Vite config-loader compatibility warning for vitest.config.ts. Tests passed; this is not currently a failing check.
- No verification process is still running.
- Production build, browser smoke test and real Gemini flow remain unrun.
- The integration risks in section 2 remain review/fix work even though the current tests pass.

The next agent should begin with the known analysis/history error-state issue, initialization race and failed-start camera cleanup, add focused regression coverage where needed, then run the build and complete documentation. No need to repeat dependency installation or all initial repository reading.

