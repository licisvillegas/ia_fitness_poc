import argparse
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from pymongo import MongoClient


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def estimate_muscle_mass_kg(
    *,
    sex: str,
    lean_mass: float,
    weight: float,
    height_cm: float,
    arm_relaxed: Optional[float],
    arm_flexed: Optional[float],
    thigh: Optional[float],
    calf: Optional[float],
) -> float:
    # Mirror ai_agents.body_assessment_agent._estimate_muscle_percent
    height_m = height_cm / 100 if height_cm else 1.75
    circumferences = []
    for measure in (arm_flexed or arm_relaxed, thigh, calf):
        if measure and height_cm:
            circumferences.append(measure / height_cm)

    base_ratio = 0.48 if sex != "female" else 0.45
    if circumferences:
        avg = sum(circumferences) / len(circumferences)
        delta = avg - base_ratio
        adj = max(-0.08, min(0.08, delta * 1.8))
    else:
        bmi = weight / (height_m**2) if height_m > 0 else 22.0
        adj = 0.04 if bmi >= 25 and lean_mass / weight > 0.75 else 0.0

    skeletal_ratio = min(0.62, max(0.4, base_ratio + adj))
    return lean_mass * skeletal_ratio


def compute_muscle_mass_kg(doc: Dict[str, Any]) -> Optional[float]:
    output = doc.get("output") or {}
    bc = output.get("body_composition") or {}

    percent = safe_float(bc.get("muscle_mass_percent"))
    input_data = doc.get("input") or {}
    measurements = input_data.get("measurements") or {}

    weight = safe_float(measurements.get("weight_kg") or measurements.get("weight"))
    if weight and percent:
        return weight * (percent / 100.0)

    lean_mass = safe_float(bc.get("lean_mass_kg"))
    if lean_mass is None and weight:
        bf = safe_float(bc.get("body_fat_percent"))
        if bf is not None:
            lean_mass = weight * (1.0 - (bf / 100.0))

    if weight is None or lean_mass is None:
        return None

    height_cm = safe_float(measurements.get("height_cm")) or 175.0
    sex = str(input_data.get("sex", "male")).lower()
    arm_relaxed = safe_float(measurements.get("arm_relaxed"))
    arm_flexed = safe_float(measurements.get("arm_flexed"))
    thigh = safe_float(measurements.get("thigh"))
    calf = safe_float(measurements.get("calf"))

    return estimate_muscle_mass_kg(
        sex=sex,
        lean_mass=lean_mass,
        weight=weight,
        height_cm=height_cm,
        arm_relaxed=arm_relaxed,
        arm_flexed=arm_flexed,
        thigh=thigh,
        calf=calf,
    )


def compute_muscle_mass_percent(doc: Dict[str, Any]) -> Optional[float]:
    output = doc.get("output") or {}
    bc = output.get("body_composition") or {}
    percent = safe_float(bc.get("muscle_mass_percent"))
    if percent is not None:
        return percent

    input_data = doc.get("input") or {}
    measurements = input_data.get("measurements") or {}
    weight = safe_float(measurements.get("weight_kg") or measurements.get("weight"))

    mm_kg = safe_float(bc.get("muscle_mass_kg"))
    if mm_kg is None:
        mm_kg = compute_muscle_mass_kg(doc)

    if weight and mm_kg is not None:
        return (mm_kg / weight) * 100.0

    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill output.body_composition.muscle_mass_kg in body_assessments."
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write changes.")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of docs to update.")
    args = parser.parse_args()

    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    mongo_db_name = os.getenv("MONGO_DB", "ia_fitness_db")

    client = MongoClient(mongo_uri)
    db = client[mongo_db_name]

    query = {
        "output.body_composition": {"$exists": True},
        "$or": [
            {"output.body_composition.muscle_mass_kg": {"$exists": False}},
            {"output.body_composition.muscle_mass_kg": None},
            {"output.body_composition.muscle_mass_percent": {"$exists": False}},
            {"output.body_composition.muscle_mass_percent": None},
        ],
    }

    cursor = db.body_assessments.find(query)
    if args.limit and args.limit > 0:
        cursor = cursor.limit(args.limit)

    updated = 0
    skipped = 0
    for doc in cursor:
        mm_kg = compute_muscle_mass_kg(doc)
        mm_pct = compute_muscle_mass_percent(doc)
        if mm_kg is None and mm_pct is None:
            skipped += 1
            continue

        updates: Dict[str, Any] = {}
        if mm_kg is not None:
            updates["output.body_composition.muscle_mass_kg"] = round(mm_kg, 1)
        if mm_pct is not None:
            updates["output.body_composition.muscle_mass_percent"] = round(mm_pct, 1)

        if updates and not args.dry_run:
            db.body_assessments.update_one({"_id": doc["_id"]}, {"$set": updates})
        if updates:
            updated += 1
        else:
            skipped += 1

    print(
        f"Completed. updated={updated} skipped={skipped} dry_run={args.dry_run}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
