#!/usr/bin/env python3
"""Run the production coach prompt against the labeled eval dataset and score
how well the AI agrees with human ratings.

Usage (from repo root, with backend/.venv active or referenced directly):

    backend/.venv/Scripts/python.exe evals/run_eval.py
    backend/.venv/Scripts/python.exe evals/run_eval.py --repeats 3
    backend/.venv/Scripts/python.exe evals/run_eval.py --limit 5 --tag baseline

Requires GEMINI_API_KEY in backend/.env (this makes real Gemini calls and
therefore costs money/time - it is intentionally not run in CI).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

EVALS_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVALS_DIR.parent
sys.path.insert(0, str(REPO_ROOT))

# The eval harness defaults to a *different* model than production
# (backend/.env's GEMINI_MODEL, normally gemini-2.5-flash-lite) so it has its
# own rate-limit quota bucket and doesn't compete with the live app for
# requests. Override with --model (e.g. --model gemini-2.5-flash-lite) to
# validate the exact production model once its quota allows it.
DEFAULT_EVAL_MODEL = "gemini-3.5-flash-lite"

# backend.gemini reads GEMINI_MODEL once, at import time, so the override has
# to be applied before that import happens. Do a minimal early parse of just
# --model here; the full parser below re-declares it for --help/consistency.
_pre_parser = argparse.ArgumentParser(add_help=False)
_pre_parser.add_argument("--model", type=str, default=DEFAULT_EVAL_MODEL)
_pre_args, _ = _pre_parser.parse_known_args()
os.environ["GEMINI_MODEL"] = _pre_args.model

from backend.gemini import MODEL_ID, GeminiInvocationError  # noqa: E402
from backend.schemas import AnalyzeInput  # noqa: E402
from backend.services.coach import CoachService  # noqa: E402

from metrics import SampleResult, summarize  # noqa: E402


def load_dataset(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_payload(sample: dict) -> AnalyzeInput:
    """Wrap a single labeled question/answer as the same AnalyzeInput shape
    the production /api/analyze endpoint sends, so the coach sees an
    identical prompt/context to what it sees in the real app."""
    return AnalyzeInput(
        interview_id=uuid4(),
        questions=[sample["question"]],
        rubric=sample["rubric"],
        answers=[{
            "question_index": 0,
            "asked": True,
            "text": sample["answer"],
            "speaking_seconds": 60.0,
        }],
        duration_seconds=60.0,
        face_metrics=[],
    )


async def run_once(sample: dict, retries: int, retry_delay: float) -> tuple[float | None, float, str | None]:
    """Returns (score, latency_seconds, error_message). Retries with backoff since the
    backend wraps rate-limit (HTTP 429) and real failures into the same GeminiInvocationError."""
    payload = build_payload(sample)
    start = time.perf_counter()
    last_error = None
    for attempt in range(retries + 1):
        try:
            output = await CoachService().coach(payload)
        except GeminiInvocationError as e:
            last_error = e.message
        except Exception as e:  # noqa: BLE001 - record any unexpected failure as a parse/run failure
            last_error = f"{type(e).__name__}: {e}"
        else:
            latency = time.perf_counter() - start
            result = output.question_results[0]
            if result.score is None:
                return None, latency, "Coach returned no score for the graded answer."
            return float(result.score), latency, None
        if attempt < retries:
            wait = retry_delay * (attempt + 1)
            print(f"[retry {attempt + 1}/{retries} in {wait:.0f}s: {last_error}]", end=" ", flush=True)
            await asyncio.sleep(wait)
    return None, time.perf_counter() - start, last_error


async def run_sample(sample: dict, repeats: int, retries: int, retry_delay: float) -> SampleResult:
    result = SampleResult(id=sample["id"], human_score=sample.get("human_score"))
    scores: list[float] = []
    for i in range(repeats):
        score, latency, error = await run_once(sample, retries, retry_delay)
        if i == 0:
            result.latency_seconds = round(latency, 3)
            result.ai_score = score
            result.error = error
        if score is not None:
            scores.append(score)
        elif i == 0:
            break  # first call failed even after retries; don't burn quota repeating a broken sample
    if repeats > 1:
        result.repeats = scores
    return result


async def run_all(samples: list[dict], repeats: int, retries: int, retry_delay: float, delay: float) -> list[SampleResult]:
    results = []
    for i, sample in enumerate(samples):
        if i > 0 and delay > 0:
            await asyncio.sleep(delay)
        print(f"  running {sample['id']}...", end=" ", flush=True)
        result = await run_sample(sample, repeats, retries, retry_delay)
        status = "ok" if result.parsed_ok else f"FAILED ({result.error})"
        print(status)
        results.append(result)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=EVALS_DIR / "dataset.json")
    parser.add_argument("--limit", type=int, default=None, help="Only run the first N samples (quick iteration).")
    parser.add_argument("--repeats", type=int, default=1, help="Repeat each sample N times to measure run-to-run consistency.")
    parser.add_argument("--tag", type=str, default=None, help="Label for this run (e.g. a prompt/model version), stored in the results file.")
    parser.add_argument("--skip-unlabeled", action="store_true", help="Skip samples with human_score == null instead of grading them.")
    parser.add_argument("--delay", type=float, default=13.0,
                         help="Seconds to wait between samples, to stay under free-tier rate limits (default 13s = ~4.6 req/min).")
    parser.add_argument("--retries", type=int, default=2, help="Retries per sample on failure (e.g. rate limits), with backoff.")
    parser.add_argument("--retry-delay", type=float, default=65.0,
                         help="Base seconds to wait before a retry (multiplied by attempt number). Free-tier RPM quotas are "
                              "a rolling per-minute window, so a retry sooner than ~60s often lands in the same window and "
                              "fails again; default waits a full minute-plus before the first retry.")
    parser.add_argument("--model", type=str, default=DEFAULT_EVAL_MODEL,
                         help="Gemini model to grade with (default: a model separate from production's GEMINI_MODEL, "
                              "so the eval doesn't compete with the app for quota). Already applied via env var before "
                              "backend.gemini was imported; declared here again just so --help/--model show up together.")
    args = parser.parse_args()

    samples = load_dataset(args.dataset)
    if args.skip_unlabeled:
        samples = [s for s in samples if s.get("human_score") is not None]
    if args.limit:
        samples = samples[: args.limit]

    unlabeled = sum(1 for s in samples if s.get("human_score") is None)
    if unlabeled:
        print(f"Note: {unlabeled} sample(s) have no human_score yet (run `rate.py` to add ratings). "
              "They will still be graded but excluded from MAE/correlation.\n")

    repeats_note = f" ({args.repeats} repeats each)" if args.repeats > 1 else ""
    print(f"Running {len(samples)} sample(s) through the coach{repeats_note}, "
          f"{args.delay:.0f}s apart (free-tier rate limit pacing)...\n")

    results = asyncio.run(run_all(samples, args.repeats, args.retries, args.retry_delay, args.delay))
    report = summarize(results)
    report["tag"] = args.tag
    report["model"] = MODEL_ID
    report["run_at"] = datetime.now(timezone.utc).isoformat()

    print("\n=== Eval results ===")
    print(f"Model:                {report['model']}")
    print(f"Tag:                  {report['tag']}")
    print(f"Samples run:          {report['sample_count']} ({report['labeled_count']} labeled)")
    print(f"Parse failure rate:   {report['parse_failure_rate']:.0%}")
    print(f"Mean absolute error:  {report['mean_absolute_error']}")
    print(f"Pearson correlation:  {report['pearson_correlation']}")
    print(f"Within 10 pts rate:   {report['within_10pt_rate']}")
    print(f"Avg consistency (sd): {report['average_consistency_stdev']}")
    print(f"Avg latency (s):      {report['average_latency_seconds']}")

    results_dir = EVALS_DIR / "results"
    results_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = f"_{args.tag}" if args.tag else ""
    out_path = results_dir / f"{stamp}{suffix}.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nSaved full results to {out_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
