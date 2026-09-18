# AI evaluation harness

Measures whether `CoachService` (the same grading path `/api/analyze` uses in
production) agrees with a human's judgment of the same answer. This closes
the gap called out in [README.md — Known limitations](../README.md#-known-limitations--roadmap):
*"Grading is not independently calibrated... there is no eval harness yet."*

No app code changes — this is a standalone measurement tool that imports and
calls `backend.services.coach.CoachService` directly.

**See [`EVAL_REPORT.md`](EVAL_REPORT.md) for the first real run**: baseline
MAE/correlation, a diagnosed miscalibration on "plausible but unevidenced"
answers, the resulting prompt fix in `coach.py`, and the before/after
numbers.

## How it works

```
evals/
    dataset.json    # labeled (question, rubric, answer, human_score) samples
    rate.py         # interactive CLI to add YOUR human_score to unrated samples
    run_eval.py     # sends each sample through the real coach prompt, compares to human_score
    metrics.py      # MAE, correlation, consistency, parse-failure-rate, latency
    compare.py      # diff two saved runs (e.g. prompt A vs prompt B)
    test_metrics.py # unit tests for metrics.py
    results/        # one JSON file per run_eval.py run, kept for history/comparison
```

1. **`dataset.json`** holds question/rubric/answer triples, each with a
   `human_score` field (0-100, same scale the coach uses) that starts as
   `null`. A dozen seed samples are included, spanning clearly weak and
   clearly strong answers to make disagreement obvious. Add your own real
   interview answers over time.
2. **You rate them** with `rate.py` — it shows each unrated sample and asks
   you to grade it like an interviewer would (relevance, specificity,
   structure), then saves your score back into `dataset.json`.
3. **`run_eval.py`** loads the dataset, builds the exact `AnalyzeInput`
   shape the backend sends in production (one question + one answer per
   sample, same rubric), calls `CoachService().coach(...)`, and records the
   AI's score, whether parsing succeeded, and latency.
4. **`metrics.py`** compares the AI's score to your `human_score` across all
   labeled samples and reports:
   - **Mean absolute error (MAE)** — average point gap between human and AI (0-100 scale). Lower is better.
   - **Pearson correlation** — do human and AI scores move together (rank agreement), independent of the exact scale.
   - **Within-10-points rate** — fraction of samples where the AI landed within 10 points of your rating.
   - **Parse-failure rate** — how often `CoachService` raised `GeminiInvocationError` (bad JSON, incomplete grades, invented evidence) instead of returning a score.
   - **Consistency (stdev)** — with `--repeats N`, how much the AI's score wobbles across repeated calls on the *same* answer.
   - **Latency** — average wall-clock time per graded sample.
5. Every run is saved to `results/<timestamp>[_tag].json` so you can compare
   prompt or model changes over time with `compare.py`.

## Usage

From the repo root, using the backend virtualenv (needs a real
`GEMINI_API_KEY` in `backend/.env` — this makes live Gemini calls, so it is
intentionally **not** run in CI):

```bash
# 1. Rate the unrated samples yourself (repeat any time you add new samples)
backend/.venv/Scripts/python.exe evals/rate.py

# 2. Run the eval
backend/.venv/Scripts/python.exe evals/run_eval.py

# Useful flags:
backend/.venv/Scripts/python.exe evals/run_eval.py --limit 5              # quick iteration on a few samples
backend/.venv/Scripts/python.exe evals/run_eval.py --repeats 3            # also measure run-to-run consistency
backend/.venv/Scripts/python.exe evals/run_eval.py --tag baseline         # label this run for later comparison
backend/.venv/Scripts/python.exe evals/run_eval.py --skip-unlabeled       # only grade samples you've already rated
backend/.venv/Scripts/python.exe evals/run_eval.py --delay 5              # faster pacing (needs a higher API quota tier)
```

### A note on rate limits and the eval's model

A free-tier Gemini API key caps `gemini-2.5-flash-lite` (production's model,
`backend/.env`'s `GEMINI_MODEL`) at **5 requests/minute and 50 requests/day**
(`generativelanguage.googleapis.com/generate_requests_per_model`). Quotas are
tracked **per model**, so `run_eval.py` **defaults to a different model,
`gemini-3.5-flash-lite`**, purely so eval runs get their own quota bucket and
never compete with (or get blocked by) the production app's usage. Override
with `--model gemini-2.5-flash-lite` to validate the exact production model
once its quota allows it — see [`EVAL_REPORT.md`](EVAL_REPORT.md) for why this
matters (the coach prompt is model-agnostic, but agreement numbers aren't
guaranteed to transfer perfectly between models).

`backend/gemini.py` wraps every failure (bad JSON, rate limit, network error)
into the same generic `GeminiInvocationError`, so `run_eval.py` can't tell
them apart by message. It still paces/retries defensively regardless of
model:

- `--delay 13` — waits 13s between samples (~4.6 req/min, under the free-tier RPM cap)
- `--retries 2` with `--retry-delay 65` — on any failure, retries twice with
  growing backoff (65s, then 130s) so a retry lands in a fresh per-minute
  window instead of immediately re-failing in the same one

A full run of ~17 samples therefore takes a few minutes. Lower `--delay`/
`--retry-delay` if you're confident the model you're targeting has a much
higher quota (e.g. a paid tier).

```bash
# 3. Compare two runs after changing a prompt or model
backend/.venv/Scripts/python.exe evals/compare.py evals/results/RUN_A.json evals/results/RUN_B.json
```

Unit tests for the metrics math (no API calls, no key required):

```bash
backend/.venv/Scripts/python.exe -m pytest evals -q
```

## Adding more samples

Append entries to `dataset.json` with the same shape:

```json
{
  "id": "s13",
  "question": "...",
  "rubric": "...",
  "answer": "...",
  "human_score": null,
  "notes": "optional context for why you'd score it that way"
}
```

Then run `rate.py` again to grade the new ones before the next `run_eval.py`.
Real transcripts from your own practice interviews (copy an answer out of a
saved history entry) make the strongest dataset — prefer those over more
synthetic examples once you have a few.

## Improving the prompt using this loop

1. Run the eval, note the MAE and which samples had the largest error.
2. Look at the `per_sample` entries with the biggest `abs_error` in the
   saved `results/*.json` — read the answer, your `human_score`, and the
   AI's `ai_score`/feedback side by side.
3. Adjust the rubric text or the `SYSTEM` prompt in
   [`backend/services/coach.py`](../backend/services/coach.py).
4. Re-run with a new `--tag` and compare against the previous run with
   `compare.py`. Keep the change only if MAE improves (or correlation
   improves without MAE regressing).

## What this intentionally does not do

- It does not call the live-interview or speech/presence pipelines — only
  the text-based coach grading, since that's the part the roadmap flags as
  uncalibrated.
- It does not run in CI (`backend/tests` is the only CI-gated suite) since
  it costs real API quota and time, and its "pass/fail" is a judgment call
  (an MAE trend), not a boolean.
