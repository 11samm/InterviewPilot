"""Pure-stdlib metrics for comparing AI coach scores against human ratings.

Kept dependency-free (no numpy/scipy) so it can run with just the backend
virtualenv. All functions take/return plain Python types.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field


@dataclass
class SampleResult:
    """One dataset sample after being run through the coach."""

    id: str
    human_score: float | None
    ai_score: float | None = None
    error: str | None = None
    latency_seconds: float | None = None
    repeats: list[float] = field(default_factory=list)

    @property
    def parsed_ok(self) -> bool:
        return self.error is None and self.ai_score is not None

    @property
    def has_label(self) -> bool:
        return self.human_score is not None


def mean_absolute_error(pairs: list[tuple[float, float]]) -> float | None:
    """Average |human - ai| over graded, labeled samples."""
    if not pairs:
        return None
    return round(sum(abs(h - a) for h, a in pairs) / len(pairs), 3)


def pearson_correlation(pairs: list[tuple[float, float]]) -> float | None:
    """Linear agreement between human and AI scores. None if undefined (<2 points or no variance)."""
    if len(pairs) < 2:
        return None
    humans = [h for h, _ in pairs]
    ais = [a for _, a in pairs]
    if len(set(humans)) < 2 or len(set(ais)) < 2:
        return None
    try:
        return round(statistics.correlation(humans, ais), 3)
    except statistics.StatisticsError:
        return None


def within_tolerance_rate(pairs: list[tuple[float, float]], tolerance: float = 10.0) -> float | None:
    """Fraction of samples where |human - ai| <= tolerance points (0-100 scale)."""
    if not pairs:
        return None
    hits = sum(1 for h, a in pairs if abs(h - a) <= tolerance)
    return round(hits / len(pairs), 3)


def consistency(repeats: list[float]) -> float | None:
    """Standard deviation of repeated AI scores for the *same* answer. Lower is more consistent."""
    if len(repeats) < 2:
        return None
    return round(statistics.pstdev(repeats), 3)


def average_consistency(results: list[SampleResult]) -> float | None:
    values = [c for r in results if (c := consistency(r.repeats)) is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def parse_failure_rate(results: list[SampleResult]) -> float:
    if not results:
        return 0.0
    failures = sum(1 for r in results if not r.parsed_ok)
    return round(failures / len(results), 3)


def average_latency(results: list[SampleResult]) -> float | None:
    values = [r.latency_seconds for r in results if r.latency_seconds is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def summarize(results: list[SampleResult]) -> dict:
    """Build the full metrics report used for console output and results/*.json."""
    labeled = [r for r in results if r.has_label and r.parsed_ok]
    pairs = [(float(r.human_score), float(r.ai_score)) for r in labeled]

    return {
        "sample_count": len(results),
        "labeled_count": len(pairs),
        "parse_failure_rate": parse_failure_rate(results),
        "mean_absolute_error": mean_absolute_error(pairs),
        "pearson_correlation": pearson_correlation(pairs),
        "within_10pt_rate": within_tolerance_rate(pairs, 10.0),
        "average_consistency_stdev": average_consistency(results),
        "average_latency_seconds": average_latency(results),
        "per_sample": [
            {
                "id": r.id,
                "human_score": r.human_score,
                "ai_score": r.ai_score,
                "abs_error": (round(abs(r.human_score - r.ai_score), 1) if r.parsed_ok and r.has_label else None),
                "error": r.error,
                "latency_seconds": r.latency_seconds,
                "repeats": r.repeats or None,
                "consistency_stdev": consistency(r.repeats),
            }
            for r in results
        ],
    }
