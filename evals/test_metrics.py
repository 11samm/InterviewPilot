"""Unit tests for evals/metrics.py. Not part of CI (no GEMINI key needed here,
but this folder is intentionally outside `backend/tests` so it stays optional).

Run with: backend/.venv/Scripts/python.exe -m pytest evals -q
"""

from metrics import (
    SampleResult,
    average_consistency,
    average_latency,
    consistency,
    mean_absolute_error,
    parse_failure_rate,
    pearson_correlation,
    summarize,
    within_tolerance_rate,
)


def test_mae_basic():
    assert mean_absolute_error([(80, 70), (50, 50), (0, 10)]) == round(20 / 3, 3)


def test_mae_empty_is_none():
    assert mean_absolute_error([]) is None


def test_pearson_correlation_needs_variance():
    assert pearson_correlation([(50, 50)]) is None
    assert pearson_correlation([(50, 50), (50, 60)]) is None  # no variance in humans
    assert pearson_correlation([(10, 20), (90, 80)]) == pearson_correlation([(10, 20), (90, 80)])


def test_pearson_perfect_agreement():
    pairs = [(10, 10), (50, 50), (90, 90)]
    assert pearson_correlation(pairs) == 1.0


def test_within_tolerance_rate():
    pairs = [(80, 75), (50, 20), (90, 85)]
    assert within_tolerance_rate(pairs, tolerance=10) == round(2 / 3, 3)


def test_consistency_stdev():
    assert consistency([70, 70, 70]) == 0.0
    assert consistency([60, 80]) == 10.0
    assert consistency([70]) is None


def test_average_consistency_ignores_single_runs():
    results = [
        SampleResult(id="a", human_score=80, ai_score=75, repeats=[70, 80]),
        SampleResult(id="b", human_score=80, ai_score=75, repeats=[]),
    ]
    assert average_consistency(results) == consistency([70, 80])


def test_parse_failure_rate():
    results = [
        SampleResult(id="a", human_score=80, ai_score=75),
        SampleResult(id="b", human_score=80, ai_score=None, error="boom"),
    ]
    assert parse_failure_rate(results) == 0.5


def test_average_latency():
    results = [
        SampleResult(id="a", human_score=80, ai_score=75, latency_seconds=1.0),
        SampleResult(id="b", human_score=80, ai_score=75, latency_seconds=3.0),
    ]
    assert average_latency(results) == 2.0


def test_summarize_excludes_unlabeled_and_failed_from_mae():
    results = [
        SampleResult(id="a", human_score=80, ai_score=70),  # labeled, |error|=10
        SampleResult(id="b", human_score=None, ai_score=90),  # unlabeled, excluded from MAE
        SampleResult(id="c", human_score=50, ai_score=None, error="parse error"),  # failed, excluded from MAE
    ]
    report = summarize(results)
    assert report["sample_count"] == 3
    assert report["labeled_count"] == 1
    assert report["mean_absolute_error"] == 10
    assert report["parse_failure_rate"] == round(1 / 3, 3)
    assert len(report["per_sample"]) == 3
