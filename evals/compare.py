#!/usr/bin/env python3
"""Compare two saved eval runs (e.g. before/after a prompt or model change).

Usage:
    python evals/compare.py evals/results/RUN_A.json evals/results/RUN_B.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def label(report: dict) -> str:
    return report.get("tag") or report.get("model") or report.get("run_at", "run")


def row(name: str, a, b) -> str:
    return f"{name:<24} {str(a):>12} {str(b):>12}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_a", type=Path)
    parser.add_argument("run_b", type=Path)
    args = parser.parse_args()

    a, b = load(args.run_a), load(args.run_b)

    print(row("", label(a), label(b)))
    print("-" * 50)
    for key in [
        "sample_count", "labeled_count", "parse_failure_rate", "mean_absolute_error",
        "pearson_correlation", "within_10pt_rate", "average_consistency_stdev", "average_latency_seconds",
    ]:
        print(row(key, a.get(key), b.get(key)))

    a_mae, b_mae = a.get("mean_absolute_error"), b.get("mean_absolute_error")
    if a_mae is not None and b_mae is not None:
        delta = round(b_mae - a_mae, 3)
        direction = "improved" if delta < 0 else ("regressed" if delta > 0 else "unchanged")
        print(f"\nMAE change: {delta:+} ({direction} vs run A)")


if __name__ == "__main__":
    main()
