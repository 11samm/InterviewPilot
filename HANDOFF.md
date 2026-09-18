# InterviewPilot — cleanup pass complete

Updated: 2026-09-17. Branch: `main`. Working tree has uncommitted changes (not committed/pushed — see "What was not done" below).

## Status: this cleanup pass is done

This continues the large rewrite already committed on `main` (`0aa45b7`). All integration bugs identified as fix-now items are fixed, the full verification suite passes, and the docs have been rewritten to match the current app instead of the original stubbed version. See [`README.md`](README.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) for the current state; this file only records what changed in this pass and what still isn't verified.

## Environment note

This pass ran in a different checkout (`C:\Users\Name\Documents\Code\InterviewPilot`) than the prior session (`D:\Samuel\Downloads\Code\InterviewPilot`). Neither `node_modules` nor `backend/.venv` existed here, so both were installed fresh (not "reinstalled" — nothing was previously present in this environment). `npm install` reported 0 vulnerabilities; the backend venv was created with Python 3.14 and `pip install -r requirements.txt -r requirements-dev.txt`.

## What changed in this pass

### 1. Analysis vs. history refresh (`app/page.tsx`)
`refreshHistory()` was inside the same `try` as a successful analysis, so a refresh failure after `setResults()`/`setPending(null)` could route to the `review` view with `pending === null`, i.e. a blank screen. `analyze()` now returns from its own try/catch immediately after a successful analysis (staying on `results`), and calls `refreshHistory()` afterward as a separate best-effort `.catch()` that only shows a toast on failure.

### 2. Single-flight session init (`app/page.tsx`)
`initialize()` now guards itself with an `initInFlight` ref: if a call is already in progress, subsequent callers (e.g. React Strict Mode's double-invoked mount effect) receive the same in-flight promise instead of firing a second `POST /api/session`, which could otherwise mint two different session cookies and orphan the first session's history. The ref clears once the call settles, so an explicit retry (e.g. submitting the access-code form) still starts a fresh request.

### 3. Camera cleanup on failed/ended live sessions
- `InterviewScreen` now wraps the `onError` passed to `useLiveAPI` so every live-session error path (connect timeout, mic denied, WS error, disconnect, unreadable message, rejected setup) calls `stopTracking()` before surfacing the toast. A camera-only failure (tracking unavailable, live session otherwise fine) is unaffected and still falls back to voice-only.
- `useFaceTracker.ts`'s `startTracking()` now stops **its own** captured stream directly (not just relying on a generation counter / a concurrent `stopTracking()` call) at every stale-check after the stream is acquired, including after `video.play()`, after `FilesetResolver.forVisionTasks()`, and when the `FaceLandmarker` itself is discarded.

### 4. Manual Finish drains like automatic completion (`useLiveAPI.ts`, `app/page.tsx`)
Extracted the drain-then-teardown logic (wait ~1.5s grace period, then poll until queued interviewer audio has actually finished playing, then stop) into a shared `drainAndStop`, exposed from the hook as `finishSession`. The automatic `end_interview` tool-call path and the manual "Finish and analyze" button now both go through it, so a manual click no longer truncates a transcript chunk that was still arriving. Added two new tests in `tests/useLiveAPI.test.ts`: one asserting the socket stays open during the grace period and a late transcript chunk is preserved, and one asserting an already-disconnected session resolves immediately without an artificial wait. Also updated the existing automatic-completion test, which now needs `vi.advanceTimersByTimeAsync()` since completion resolves through a promise microtask instead of firing synchronously inside the timer callback.

### 5. Lint hygiene (`app/page.tsx`)
Removed the four unused imports (`FaceMetric`, `Mic`, `Eye`, `Activity`).

### 6. Untracked generated files
`tsconfig.tsbuildinfo` and the nested `backend/**/__pycache__/*.pyc` files were tracked in Git despite being covered by `.gitignore`. Ran `git rm -r --cached` on them (working-tree files kept; only the Git index entries removed). This is a pending, uncommitted change — see "What was not done."

### 7. Documentation
- Rewrote `README.md` for the current setup: correct clone URL, backend-owned Gemini key / `BACKEND_URL`-only frontend env, session/access-code model, persisted history, per-question grading and scoring formula, security model, and test/build commands.
- Added `ARCHITECTURE.md`: full data-flow diagram, per-file breakdown of both frontend and backend, SQLite schema, and an explicit verified-state table.
- Added a current-status banner to the top of `InterviewPilot_Upgrade_Action_Plan.md` and `InterviewPilot_Resume_Upgrade_Roadmap.md` pointing at the README/ARCHITECTURE for ground truth, so their original "still to build" lists aren't mistaken for current facts.
- Rewrote this file.

## Verification results (this pass, actually run)

```powershell
npm run typecheck                                              # PASS — no TypeScript errors
npm test                                                        # PASS — 11/11 tests, 2 files
backend/.venv/Scripts/python.exe -m pytest backend/tests -q     # PASS — 24/24 tests
npm run lint                                                    # PASS — 0 errors, 2 warnings
npm run build                                                   # PASS — production build succeeded
```

The 2 remaining lint warnings are pre-existing and unrelated to this pass: `actionTypes` assigned-but-only-used-as-a-type in both `components/ui/use-toast.ts` and `hooks/use-toast.ts` (duplicate shadcn toast files already present before this work).

## What was not done / remains unverified

- **No browser smoke test was performed.** This pass ran in a non-interactive shell with no way to open a real browser, grant camera/microphone permissions, or click through the UI. The backend-down message, setup flow, mic/camera-deny handling, voice-only fallback, finish/retry/history/delete flows are all implemented and covered by the automated test suites referenced above, but were **not** exercised end-to-end in a real browser in this pass.
- **No real Gemini call was made.** There is no `GEMINI_API_KEY` configured in this environment, so `POST /api/plan`, `POST /api/live-token`, the Live WebSocket connection itself, `POST /api/analyze`, and `POST /api/deepdive` have only been exercised through mocked/unit tests, never against the live API. Treat the Live ephemeral-token flow and grading calls as **implemented but unverified**, per `ARCHITECTURE.md` §5.
- **Nothing was committed or pushed.** All changes described above are in the working tree only, per the instruction not to commit/push/deploy without being asked.
- The integration risks listed as "document, do not build" in the cleanup plan remain genuinely unbuilt by design: concurrent in-progress-analyze locking, history retention/cleanup, refresh-during-live-recording recovery, PostgreSQL/real accounts, Dockerfile/hosting, and grading-calibration claims. These are called out in the README's "Known limitations" section rather than silently left undocumented.

## Suggested continuation

If picking this up again: run a real browser smoke test (with a configured `GEMINI_API_KEY` and working mic/camera) using the checklist in the previous version of this file / the README's demo flow, then decide whether to commit. No further code changes are expected before that unless the smoke test surfaces a new bug.
