def _parse_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned == "":
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _has_time_target(item):
    for key in ("target_time_seconds", "time_seconds", "time"):
        val = _parse_number(item.get(key))
        if val is not None and val > 0:
            return True
    return False


def _has_reps_target(item):
    for key in ("target_reps", "reps"):
        val = _parse_number(item.get(key))
        if val is not None and val > 0:
            return True
    return False


def normalize_routine_items(items):
    if not isinstance(items, list):
        return items

    for item in items:
        if not isinstance(item, dict):
            continue
        nested = item.get("items")
        if isinstance(nested, list):
            normalize_routine_items(nested)

        if item.get("item_type") == "rest":
            continue

        exercise_type = str(item.get("exercise_type") or item.get("type") or "").strip().lower()
        if exercise_type in ("cardio", "time"):
            item["target_reps"] = 0
        else:
            item["target_time_seconds"] = 0

    return items
