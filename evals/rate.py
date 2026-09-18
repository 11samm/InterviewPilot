#!/usr/bin/env python3
"""Interactive CLI to add your own human ratings to evals/dataset.json.

Shows each question/answer that doesn't have a human_score yet, asks you to
score it 0-100 (the same scale the coach uses) and optionally leave a note,
then writes it back to the dataset file. Run this BEFORE run_eval.py so
there is something to compare the AI against.

Usage:
    python evals/rate.py
    python evals/rate.py --dataset evals/dataset.json --rerate  # re-rate everything, including already-labeled samples
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

EVALS_DIR = Path(__file__).resolve().parent


def load(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path: Path, samples: list[dict]) -> None:
    path.write_text(json.dumps(samples, indent=2) + "\n", encoding="utf-8")


def prompt_score() -> float | None:
    while True:
        raw = input("  Your score (0-100, 's' to skip, 'q' to quit): ").strip().lower()
        if raw == "q":
            return None
        if raw == "s":
            return "skip"  # type: ignore[return-value]
        try:
            value = float(raw)
        except ValueError:
            print("  Please enter a number between 0 and 100.")
            continue
        if 0 <= value <= 100:
            return value
        print("  Score must be between 0 and 100.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=EVALS_DIR / "dataset.json")
    parser.add_argument("--rerate", action="store_true", help="Also re-rate samples that already have a human_score.")
    args = parser.parse_args()

    samples = load(args.dataset)
    todo = samples if args.rerate else [s for s in samples if s.get("human_score") is None]

    if not todo:
        print("Every sample already has a human_score. Pass --rerate to review them again, "
              "or add new samples to dataset.json.")
        return

    print(f"{len(todo)} sample(s) to rate. Grade like you would as an interviewer: relevance, "
          "specificity of concrete detail, and clarity of structure (situation/action/result).\n")

    rated = 0
    for sample in todo:
        print("-" * 70)
        print(f"[{sample['id']}] Q: {sample['question']}")
        print(f"Rubric: {sample['rubric']}")
        print(f"\nAnswer:\n{sample['answer']}\n")
        if sample.get("human_score") is not None:
            print(f"(current human_score: {sample['human_score']})")

        result = prompt_score()
        if result is None:
            break
        if result == "skip":
            continue

        note = input("  Optional note (why this score, or blank): ").strip()
        sample["human_score"] = result
        sample["rated_at"] = datetime.now(timezone.utc).isoformat()
        if note:
            sample["notes"] = note
        rated += 1
        save(args.dataset, samples)  # persist after every rating so nothing is lost

    print(f"\nSaved {rated} rating(s) to {args.dataset}.")
    remaining = sum(1 for s in samples if s.get("human_score") is None)
    if remaining:
        print(f"{remaining} sample(s) still unrated.")
    else:
        print("All samples are rated. Run `python evals/run_eval.py` to compare the AI against your ratings.")


if __name__ == "__main__":
    main()
